"""Junta Electoral PBA 2025: independent download, normalize, validate and load stages."""
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen

from build_data import BLOCK_ALIASES, norm_group, norm_name

APP = Path(__file__).resolve().parents[1]
BASE = "https://www.juntaelectoral.gba.gov.ar/escrutinio-definitivo-2025/"
SOURCE_ID = "2025_generales_legislatura_provincial_jepba_definitivo"
DEFAULT_ROOT = Path(r"G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos\05_JuntaElectoralPBA\2025\20261002")
ALIASES = {"DEL PILAR": "PILAR", "PARTIDO DE MONTE HERMOSO": "MONTE HERMOSO",
           "PARTIDO DE PINAMAR": "PINAMAR", "PARTIDO DE VILLA GESELL": "VILLA GESELL",
           "CORONEL DE MARINA L ROSALES": "CORONEL DE MARINA LEONARDO ROSALES",
           "EXALTAC DE LA CRUZ": "EXALTACION DE LA CRUZ", "PDO MONTE HERMOSO": "MONTE HERMOSO",
           "PDO VILLA GESELL": "VILLA GESELL"}


def check(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(path)


def sha(content):
    return hashlib.sha256(content).hexdigest()


class Page(HTMLParser):
    """Collect semantic table cells and visible text; never execute source scripts."""
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.tables, self.text, self.links = [], [], []
        self.table = self.row = self.cell = None
        self.skip = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style"):
            self.skip += 1
        if self.skip:
            return
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "table":
            check(self.table is None, "Nested results table unsupported")
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag == "th" and self.table is not None and self.row is None:
            # The official section pages omit <tr> inside <thead>.
            self.row = []
            self.cell = {"tag": tag, "id": attrs.get("id"), "parts": []}
        elif tag in ("td", "th") and self.row is not None:
            self.cell = {"tag": tag, "id": attrs.get("id"), "parts": []}

    def handle_data(self, text):
        if self.skip:
            return
        text = " ".join(text.split())
        if text:
            self.text.append(text)
            if self.cell is not None:
                self.cell["parts"].append(text)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if self.skip:
            return
        if tag in ("td", "th") and self.cell is not None:
            self.cell["text"] = " ".join(self.cell.pop("parts"))
            self.row.append(self.cell)
            self.cell = None
        elif tag in ("tr", "thead") and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def integer(text):
    if text in ("-", "", "—"):
        return None
    check(bool(re.fullmatch(r"(?:\d{1,3}(?:\.\d{3})+|\d+)", text)), f"Invalid integer: {text!r}")
    return int(text.replace(".", ""))


def percentage(text):
    if text in ("-", "", "—"):
        return None
    clean = text.replace("%", "").strip().replace(",", ".")
    check(bool(re.fullmatch(r"\d+(?:\.\d+)?", clean)), f"Invalid percent: {text!r}")
    value = float(clean)
    check(0 <= value <= 100, f"Percent out of range: {text}")
    return value


def category(text):
    label = norm_name(text)
    if "DIPUTADOS" in label and "PROV" in label:
        return "diputados_provinciales"
    if "SENADORES" in label and "PROV" in label:
        return "senadores_provinciales"
    if "CONCEJALES" in label:
        return "concejales"
    raise ValueError(f"Unknown category: {text}")


def parse_page(html, identifier, kind):
    page = Page(html)
    text = " ".join(page.text)
    tables = [t for t in page.tables if any(any(norm_name(c["text"]) == "LISTA" for c in row) and any("PARTIDOS POLITICOS" == norm_name(c["text"]) for c in row) for row in t)]
    check(len(tables) == 1, f"{kind} {identifier}: expected one labeled result table, got {len(tables)}")
    table = tables[0]
    header = next(row for row in table if any(norm_name(c["text"]) == "LISTA" for c in row))
    labels = [norm_name(c["text"]) for c in header]
    list_i, name_i = labels.index("LISTA"), labels.index("PARTIDOS POLITICOS")
    categories = {}
    for i, cell in enumerate(header):
        if i in (list_i, name_i) or labels[i] == "PORCENTAJE":
            continue
        cat = category(cell["text"])
        check(i+1 < len(header) and labels[i+1] == "PORCENTAJE", "Missing category percentage header")
        check(cat not in categories, "Duplicate category header")
        categories[cat] = {"column": i, "cargo_label": cell["text"], "cargo_codigo": cell["id"], "groups": [], "totals": {}}
    for row in table[table.index(header)+1:]:
        if not row:
            continue
        check(len(row) == len(header), f"{kind} {identifier}: irregular result row")
        code, name = row[list_i]["text"], row[name_i]["text"]
        for cat, block in categories.items():
            i = block["column"]
            entry = {"votos": integer(row[i]["text"]), "porcentaje_oficial": percentage(row[i+1]["text"]),
                     "votos_original": row[i]["text"], "porcentaje_original": row[i+1]["text"]}
            if code:
                check(code.isdigit(), f"Invalid list ID: {code}")
                entry.update({"lista_codigo": code, "agrupacion_nombre_oficial": name})
                block["groups"].append(entry)
            else:
                label = norm_name(name)
                if label == "EN BLANCO":
                    label = "VOTO EN BLANCO"
                check(label not in block["totals"], f"Duplicate subtotal: {label}")
                block["totals"][label] = {**entry, "nombre_original": name}
    provincial = [c for c in categories if c != "concejales"]
    check(len(provincial) == 1, "Expected one provincial category")
    metadata = {}
    for label, field in [("Electores habilitados", "electores"), ("Total de mesas", "mesas_totales"), ("Mesas escrutadas", "mesas_escrutadas")]:
        match = re.search(re.escape(label) + r"\s+([\d.]+)", text, re.I)
        check(match is not None, f"Missing metadata: {label}")
        metadata[field] = integer(match[1])
    match = re.search(r"Mesas escrutadas\s+[\d.]+\s+Porcentaje\s+([\d.,]+)\s*%", text, re.I)
    check(match is not None, "Missing counted percentage")
    metadata["porcentaje_escrutado"] = percentage(match[1])
    if kind == "distrito":
        match = re.search(r"Distrito\s+(\d{3})\s*-\s*(.*?)\s+Electores habilitados", text, re.I)
        check(match is not None and match[1] == identifier, "District identity mismatch")
        metadata.update({"distrito_junta_id": identifier, "distrito_nombre_original": match[2]})
    return {**metadata, "categoria_provincial": provincial[0], "categories": categories}


def validate_page(parsed):
    check(parsed["mesas_escrutadas"] <= parsed["mesas_totales"], "Counted tables exceed total")
    check(abs(parsed["porcentaje_escrutado"]-100*parsed["mesas_escrutadas"]/parsed["mesas_totales"]) <= .011, "Counted percentage mismatch")
    for cat, block in parsed["categories"].items():
        groups, totals = block["groups"], block["totals"]
        check(len({g["lista_codigo"] for g in groups}) == len(groups), f"Duplicate list: {cat}")
        for name in ("VOTOS POSITIVOS", "VOTO EN BLANCO", "TOTAL DE VOTOS"):
            check(name in totals and totals[name]["votos"] is not None, f"Missing total: {cat}/{name}")
        positive, blank, total = [totals[n]["votos"] for n in ("VOTOS POSITIVOS", "VOTO EN BLANCO", "TOTAL DE VOTOS")]
        check(sum(g["votos"] or 0 for g in groups) == positive, f"Group sum != positive: {cat}")
        check(positive + blank == total, f"Published total != positive+blank: {cat}")
        check(total <= parsed["electores"], "Published votes exceed electors")
        for g in groups:
            check((g["votos"] is None) == (g["porcentaje_oficial"] is None), "Mixed dash/numeric result")
            if g["votos"] is not None:
                check(abs(g["porcentaje_oficial"] - 100*g["votos"]/positive) <= .011, f"List percentage mismatch: {cat}/{g['lista_codigo']}")
        for name, denominator in [("VOTOS POSITIVOS", total), ("VOTO EN BLANCO", total), ("TOTAL DE VOTOS", parsed["electores"])]:
            g = totals[name]
            check(abs(g["porcentaje_oficial"] - 100*g["votos"]/denominator) <= .011, f"Subtotal percent mismatch: {name}")


def download(root):
    raw = root / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    manifest_path = raw / "manifest.json"
    manifest = read(manifest_path) if manifest_path.exists() else {"base_url": BASE, "files": {}, "errors": {}}
    names = ["index.html"] + [f"distrito_{i:03}.html" for i in range(1,136)] + [f"seccion_{i}.html" for i in range(1,9)]
    def fetch(name):
        path, url = raw / name, BASE + name
        if path.exists():
            previous = manifest["files"].get(name)
            check(previous and previous["sha256"] == sha(path.read_bytes()), f"Untracked or altered raw file: {name}")
            return name, previous
        for attempt in range(3):
            try:
                with urlopen(Request(url, headers={"User-Agent": "AtlasElectoralPBA/1.0 (public-election-data-audit)"}), timeout=40) as response:
                    content = response.read()
                    content.decode("utf-8")
                    check(b"ESCRUTINIO DEFINITIVO" in content, f"Unexpected document at {url}")
                    metadata = {"url": url, "downloaded_at": datetime.now(timezone.utc).isoformat(), "sha256": sha(content), "bytes": len(content), "http_status": response.status}
                path.write_bytes(content)
                return name, metadata
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt+1)
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(fetch,name):name for name in names}
        for future in as_completed(futures):
            name = futures[future]
            try:
                _, metadata = future.result()
                manifest["files"][name] = metadata
                manifest["errors"].pop(name, None)
            except Exception as error:
                manifest["errors"][name] = str(error)
            write(manifest_path, manifest)
            if len(manifest["files"]) % 20 == 0:
                print(f"raw: {len(manifest['files'])}/{len(names)}", flush=True)
    check(not manifest["errors"], f"Download errors: {manifest['errors']}")
    print(f"Raw complete: {len(manifest['files'])} documents", flush=True)


def normalize(root, app=APP):
    raw, dest = root / "raw", root / "normalized"
    write(dest / "stage_status.json", {"status": "running"})
    manifest = read(raw / "manifest.json")
    errors, districts, sections = [], {}, {}
    for kind, ids in [("distrito", [f"{i:03}" for i in range(1,136)]), ("seccion", [str(i) for i in range(1,9)])]:
        for identifier in ids:
            name = f"{kind}_{identifier}.html"
            try:
                content = (raw / name).read_bytes()
                check(sha(content) == manifest["files"][name]["sha256"], "Raw checksum mismatch")
                parsed = parse_page(content.decode("utf-8"), identifier, kind)
                validate_page(parsed)
                parsed["source"] = manifest["files"][name]
                (districts if kind == "distrito" else sections)[identifier] = parsed
            except Exception as error:
                errors.append({"file": name, "error": str(error)})
    write(dest / "parsing_audit.json", {"districts": len(districts), "sections": len(sections), "errors": errors})
    check(not errors, f"Parsing failed; see {dest / 'parsing_audit.json'}: {errors[:4]}")
    electoral = read(app / "data/electoral_data.json")
    parties = {f["properties"]["key"]: f["properties"] for f in read(app / "data/partidos_pba.geojson")["features"]}
    by_name = {norm_name(p["partido"]): k for k,p in parties.items()}
    section_candidates = defaultdict(set)
    for rows in electoral["circuit"]["elections"].values():
        for row in rows.values():
            if row.get("seccionprovincial_id"):
                section_candidates[row["partido_norm"]].add(str(int(row["seccionprovincial_id"])))
    mapping, facts, summaries = [], [], []
    for identifier, district in districts.items():
        original_name = district["distrito_nombre_original"]
        name = norm_name(original_name)
        key = by_name.get(ALIASES.get(name,name))
        check(key is not None, f"Unmapped party: {identifier}/{original_name}/{name}")
        candidates = section_candidates[key]
        check(len(candidates) == 1, f"Party must have one section: {key}/{candidates}")
        section = next(iter(candidates))
        check(district["categoria_provincial"] == sections[section]["categoria_provincial"], f"Section/category mismatch: {key}")
        dimension = {"partido_id": key, "partido": parties[key]["partido"], "distrito_junta_id": identifier,
                     "distrito_nombre_original": original_name, "seccion_electoral_id": section,
                     "categoria_provincial": district["categoria_provincial"]}
        mapping.append(dimension)
        common = {**dimension, "eleccion_id": "PBA2025", "fecha": "2025-09-07", "anio": 2025,
                  "ambito": "provincial", "tipo_eleccion": "general", "estado_escrutinio": "definitivo",
                  "electores": district["electores"], "mesas_totales": district["mesas_totales"], "mesas_escrutadas": district["mesas_escrutadas"],
                  "porcentaje_escrutado": district["porcentaje_escrutado"], "source": district["source"]}
        for cat, block in district["categories"].items():
            summary = {**common, "categoria": cat, "cargo_label": block["cargo_label"], "cargo_codigo": block["cargo_codigo"], "totals": block["totals"], "votantes": None,
                       "nota_total": "El total publicado cierra como positivos+blancos; no acredita el total de sufragantes ni desglosa nulos."}
            summaries.append(summary)
            for group in block["groups"]:
                natural = ["PBA2025", key, cat, group["lista_codigo"]]
                facts.append({"resultado_id": "|".join(natural), **common, "categoria": cat, "cargo_codigo": block["cargo_codigo"], **group,
                              "porcentaje_calculado": 100*group["votos"]/block["totals"]["VOTOS POSITIVOS"]["votos"] if group["votos"] is not None else None})
    check(len(mapping) == 135 and len({r["partido_id"] for r in mapping}) == 135, "District mapping not bijective")
    check({r["partido_id"] for r in mapping} == set(parties), "Party coverage mismatch")
    check(len({r["resultado_id"] for r in facts}) == len(facts), "Duplicate natural result key")
    reconciliation = []
    for section, source in sections.items():
        cat = source["categoria_provincial"]
        accumulated = Counter()
        for fact in facts:
            if fact["seccion_electoral_id"] == section and fact["categoria"] == cat:
                accumulated[fact["lista_codigo"]] += fact["votos"] or 0
        expected = {g["lista_codigo"]: g["votos"] or 0 for g in source["categories"][cat]["groups"]}
        differences = {k: accumulated[k]-expected.get(k,0) for k in set(accumulated)|set(expected) if accumulated[k] != expected.get(k,0)}
        total_differences = {}
        district_summaries = [s for s in summaries if s["categoria"] == cat and s["seccion_electoral_id"] == section]
        for key, entry in source["categories"][cat]["totals"].items():
            delta = sum(s["totals"][key]["votos"] for s in district_summaries)-entry["votos"]
            if delta:
                total_differences[key] = delta
        meta_differences = {field: sum(s[field] for s in district_summaries)-source[field] for field in ("electores","mesas_totales","mesas_escrutadas") if sum(s[field] for s in district_summaries)!=source[field]}
        reconciliation.append({"seccion": section, "categoria": cat, "distritos": len(district_summaries), "diferencias_agrupaciones": differences, "diferencias_totales": total_differences, "diferencias_metadatos": meta_differences, "source": source["source"]})
    audit = {"districts": len(mapping), "records": len(facts), "records_with_votes": sum(f["votos"] is not None for f in facts), "categories": dict(Counter(f["categoria"] for f in facts)),
             "duplicate_natural_keys": 0, "section_reconciliation": reconciliation, "errors": errors}
    write(dest / "validation.json", audit)
    check(all(not r["diferencias_agrupaciones"] and not r["diferencias_totales"] and not r["diferencias_metadatos"] for r in reconciliation), "Section reconciliation failed; see validation.json")
    normalized = {"schema_version": 1, "natural_key": ["eleccion_id","partido_id","categoria","lista_codigo"], "technical_key": "resultado_id (concatenacion determinista de clave natural)",
                  "territories": mapping, "sections": {k:{"categoria_provincial":v["categoria_provincial"],"source":v["source"]} for k,v in sections.items()},
                  "summaries": summaries, "results": facts, "validation": audit}
    write(dest / "jepba_2025_normalized.json", normalized)
    write(dest / "stage_status.json", {"status": "passed", "sha256": sha((dest / "jepba_2025_normalized.json").read_bytes())})
    print(json.dumps({k:v for k,v in audit.items() if k!='section_reconciliation'}, ensure_ascii=False), flush=True)


def package(normalized):
    rows = {}
    facts = defaultdict(list)
    for fact in normalized["results"]:
        if fact["categoria"] != "concejales":
            facts[fact["partido_id"]].append(fact)
    for summary in normalized["summaries"]:
        if summary["categoria"] == "concejales":
            continue
        key, totals = summary["partido_id"], summary["totals"]
        forces, blocks = {}, Counter()
        for fact in facts[key]:
            if fact["votos"] is None:
                continue
            name, votes = fact["agrupacion_nombre_oficial"], fact["votos"]
            check(name not in forces, f"Force name collision: {key}/{name}")
            forces[name] = votes
            block = BLOCK_ALIASES.get(norm_group(name))
            if block:
                blocks[block] += votes
        positive, blank, total = [totals[k]["votos"] for k in ("VOTOS POSITIVOS","VOTO EN BLANCO","TOTAL DE VOTOS")]
        top = sorted(forces.items(), key=lambda x: (-x[1], x[0]))
        rows[key] = {"key":key,"partido":summary["partido"],"partido_norm":key,"distrito_junta_id":summary["distrito_junta_id"],
                     "seccionprovincial_id":summary["seccion_electoral_id"],"categoria":summary["categoria"],
                     "electores":summary["electores"],"votantes":None,"participacion":None,"ausentismo":None,
                     "total_publicado":total,"total_publicado_pct_padron":totals["TOTAL DE VOTOS"]["porcentaje_oficial"]/100,
                     "positivos":positive,"blanco":blank,"nulo":None,"impugnado":None,"recurrido":None,
                     "pct_blanco":None,"pct_blanco_total_publicado":blank/total,"pct_nulo":None,"pct_impugnado":None,"pct_recurrido":None,
                     "fuerzas":forces,"fuerzas_pct":{k:v/positive for k,v in forces.items()},"bloques":dict(blocks),"bloques_pct":{k:v/positive for k,v in blocks.items()},
                     "ganador":top[0][0],"ganador_votos":top[0][1],"segundo":top[1][0],"segundo_votos":top[1][1],"margen":(top[0][1]-top[1][1])/positive,
                     "mesas_totales":summary["mesas_totales"],"mesas_escrutadas":summary["mesas_escrutadas"],"porcentaje_escrutado":summary["porcentaje_escrutado"],"fuente_url":summary["source"]["url"]}
    source = {"id":SOURCE_ID,"year":"2025","date":"2025-09-07","label":"2025 · Provinciales PBA · Legislatura · Definitivo", "election_type":"Generales provinciales", "cargo":"Legislatura provincial (Diputados / Senadores segun seccion)",
              "source_name":"Junta Electoral de la Provincia de Buenos Aires", "source_url":BASE,"scrutiny":"definitivo","available_levels":["party"],"minimum_level":"party",
              "unavailable_levels_reason":"Fuente incorporada exclusivamente por partido/distrito; no contiene circuitos ni localidades.",
              "available_metrics":["votos","competitividad"],"available_vote_types":["positivo","blanco"],"available_positive_measures":["share_positive","gap_winner"],
              "vote_share_basis":"valid_published",
              "voter_total_available":False,"total_definition":"Total publicado = positivos + blancos. No equivale a sufragantes verificados; nulos no publicados.",
              "rows":sum(len(v) for v in facts.values()),"parties":len(rows),"circuits":None,"duplicates":0,"null_keys":0,
              "votes":None,"electors":sum(r["electores"] for r in rows.values()),"positive":sum(r["positivos"] for r in rows.values()),
              "total_publicado":sum(r["total_publicado"] for r in rows.values()),"categories":normalized["sections"]}
    return {"schema_version":1,"source":source,"party_results":rows,"normalization_sha256":sha(json.dumps(normalized,sort_keys=True,ensure_ascii=False).encode())}


def merge_into(payload, addition):
    sid = addition["source"]["id"]
    payload["sources"] = [s for s in payload["sources"] if s["id"] != sid] + [addition["source"]]
    payload["party"]["elections"][sid] = addition["party_results"]
    for level in ("circuit","locality"):
        payload[level]["elections"][sid] = {}
    return payload


def load(root, app=APP):
    normalized_path = root / "normalized/jepba_2025_normalized.json"
    status = read(root / "normalized/stage_status.json")
    check(status.get("status") == "passed" and status.get("sha256") == sha(normalized_path.read_bytes()), "Normalization incomplete or altered; rerun normalize")
    normalized = read(normalized_path)
    manifest = read(root / "raw/manifest.json")
    check(not manifest["errors"], "Raw manifest contains errors")
    for name, metadata in manifest["files"].items():
        check(sha((root / "raw" / name).read_bytes()) == metadata["sha256"], f"Raw changed: {name}")
    for record in normalized["summaries"] + list(normalized["sections"].values()):
        metadata = record["source"]
        name = metadata["url"].rsplit("/", 1)[-1]
        check(metadata == manifest["files"].get(name), f"Stale normalization: {name}")
    check(normalized["validation"]["districts"] == 135, "Incomplete normalization")
    addition = package(normalized)
    target = app / "data/electoral_data.json"
    payload = read(target)
    snapshot = root / "load_audit/electoral_data_before.json"
    if not snapshot.exists():
        write(snapshot, payload)
    before = {level:{k:v for k,v in payload[level]["elections"].items() if k != SOURCE_ID} for level in ("party","circuit","locality")}
    defaults = dict(payload["defaults"])
    merge_into(payload, addition)
    check(payload["defaults"] == defaults, "Defaults changed")
    check(all({k:v for k,v in payload[level]["elections"].items() if k!=SOURCE_ID} == before[level] for level in before), "Existing elections changed")
    write(app / "data/jepba_2025.json", addition)
    temporary = target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    temporary.replace(target)
    write(root / "load_audit/validation.json", {"party_rows":135,"existing_elections_unchanged":True,"defaults_unchanged":True,"normalized_file_sha256":sha(normalized_path.read_bytes()),"electoral_sha256":sha(target.read_bytes())})
    print(f"Loaded {len(addition['party_results'])} parties: {SOURCE_ID}", flush=True)


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage",choices=["download","normalize","load"])
    parser.add_argument("--root",type=Path,default=DEFAULT_ROOT)
    args=parser.parse_args()
    {"download":download,"normalize":normalize,"load":load}[args.stage](args.root)
