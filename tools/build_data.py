import argparse
import csv
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from xlsx_reader import iter_xlsx_rows
from radio_locality import DEFAULT_NOMENCLATOR, derive_assignments, load_nomenclator


APP_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = APP_DIR / "data"
DEFAULT_DATA_ROOT = Path(r"G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos")
DATA_ROOT = Path(os.environ.get("ATLAS_DATA_ROOT", DEFAULT_DATA_ROOT))
DINE_DIR = DATA_ROOT / "01_DINE"
CIRCUIT_GEOJSON = DATA_ROOT / "03_circuitoselectoralespba" / "01_CircuitosElectorales2025_PBA3.geojson"
PARTY_GEOJSON = DATA_ROOT / "03_circuitoselectoralespba" / "02_PartidosPBA2.geojson"
LOCALITY_GEOJSON = DATA_ROOT / "03_circuitoselectoralespba" / "03_LocalidadesPBA_MAS2000.geojson"
SOCIO_DIR = DATA_ROOT / "04_Socioeconomicos"
LOCALITY_NOMENCLATOR = DEFAULT_NOMENCLATOR
KNOWN_GEOMETRY_REPAIRS = {
    "party": set(),
    "locality": {"06644010"},
    "circuit": {"19"},
}

REQUIRED_COLUMNS = {
    "ano", "eleccion_tipo", "distrito_id", "seccion_id", "seccion_nombre",
    "circuito_id", "mesa_id", "mesa_tipo", "mesa_electores", "cargo_nombre",
    "votos_tipo", "votos_cantidad", "agrupacion_nombre",
}

VOTE_TYPE_ALIASES = {
    "BLANCO": "EN BLANCO",
    "BLANCOS": "EN BLANCO",
    "NULOS": "NULO",
    "IMPUGNADOS": "IMPUGNADO",
    "RECURRIDOS": "RECURRIDO",
    "POSITIVOS": "POSITIVO",
}

BLOCK_ALIASES = {
    "LA LIBERTAD AVANZA": "LLA",
    "ALIANZA LA LIBERTAD AVANZA": "LLA",
    "UNION POR LA PATRIA": "PERONISMO_K",
    "UNIÓN POR LA PATRIA": "PERONISMO_K",
    "ALIANZA FUERZA PATRIA": "PERONISMO_K",
    "FRENTE DE TODOS": "PERONISMO_K",
}

BLOCK_LABELS = {
    "LLA": "La Libertad Avanza",
    "PERONISMO_K": "Peronismo / kirchnerismo",
}

PARTY_ALIASES = {
    "A GONZALES CHAVES": "ADOLFO GONZALES CHAVES",
    "CAEUELAS": "CANUELAS",
    "CA UELAS": "CANUELAS",
    "CNEL DE MARINA L ROSALES": "CORONEL DE MARINA L ROSALES",
    "CORONEL ROSALES": "CORONEL DE MARINA L ROSALES",
    "9 DE JULIO": "NUEVE DE JULIO",
    "25 DE MAYO": "VEINTICINCO DE MAYO",
    "GENERAL LAMADRID": "GENERAL LA MADRID",
    "GENERAL MADARIAGA": "GENERAL JUAN MADARIAGA",
    "MORNN": "MORON",
}


def norm_text(value):
    return (value or "").strip()


def canonical_field(value):
    text = unicodedata.normalize("NFD", norm_text(value).lower())
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def normalized_reader(handle, path):
    reader = csv.DictReader(handle)
    columns = reader.fieldnames or []
    canonical_columns = {canonical_field(column): column for column in columns}
    missing = sorted(REQUIRED_COLUMNS - set(canonical_columns))
    if missing:
        raise ValueError(f"{path.name}: faltan columnas esenciales: {', '.join(missing)}")
    for row in reader:
        yield {key: row.get(original, "") for key, original in canonical_columns.items()}


def configure_paths(data_root, output_dir=None):
    global DATA_ROOT, DATA_DIR, DINE_DIR, CIRCUIT_GEOJSON, PARTY_GEOJSON, LOCALITY_GEOJSON, SOCIO_DIR
    DATA_ROOT = Path(data_root).resolve()
    DATA_DIR = Path(output_dir).resolve() if output_dir else APP_DIR / "data"
    DINE_DIR = DATA_ROOT / "01_DINE"
    CIRCUIT_GEOJSON = DATA_ROOT / "03_circuitoselectoralespba" / "01_CircuitosElectorales2025_PBA3.geojson"
    PARTY_GEOJSON = DATA_ROOT / "03_circuitoselectoralespba" / "02_PartidosPBA2.geojson"
    LOCALITY_GEOJSON = DATA_ROOT / "03_circuitoselectoralespba" / "03_LocalidadesPBA_MAS2000.geojson"
    SOCIO_DIR = DATA_ROOT / "04_Socioeconomicos"


def norm_name(value):
    text = norm_text(value).upper().replace("Ñ", "N")
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = re.sub(r"^PARTIDO\s+(DE|DEL)\s+", "", text)
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return PARTY_ALIASES.get(text, text)


def title_name(value):
    return " ".join(word.capitalize() for word in norm_text(value).lower().split())


def norm_group(value):
    text = norm_name(value)
    return text


def norm_circuit(value):
    text = norm_text(value).upper()
    if re.fullmatch(r"\d+", text):
        return str(int(text))
    match = re.fullmatch(r"0*(\d+)([A-Z]+)", text)
    if match:
        return f"{int(match.group(1))}{match.group(2)}"
    return text.lstrip("0") or text


def norm_code(value, width):
    text = norm_text(value)
    if re.fullmatch(r"\d+", text):
        return text.zfill(width)
    return text


def party_key_from_codes(province_id, department_id, valid_codes=None):
    department = norm_code(department_id, 3)
    candidate = f"{norm_code(province_id, 2)}{department}"
    fallback = f"06{department}"
    if valid_codes and candidate not in valid_codes and fallback in valid_codes:
        return fallback
    return candidate


def party_code(props):
    return norm_text(props.get("CODIGO") or props.get("cde"))


def party_name(props):
    return props.get("NOMBRE") or props.get("nam") or props.get("fna") or props.get("departamen")


def resolve_party_key(province_id, department_id, party_name, valid_codes, codes_by_name):
    key = party_key_from_codes(province_id, department_id, valid_codes)
    if key in valid_codes:
        return key
    return codes_by_name.get(norm_name(party_name), key)


def as_int(value):
    try:
        if value is None or value == "":
            return 0
        return int(float(str(value).replace(",", ".")))
    except ValueError:
        return 0


def pct(part, total):
    return part / total if total else None


def round_or_none(value, digits=6):
    return round(value, digits) if value is not None else None


def empty_bucket():
    return {
        "partido": "",
        "partido_norm": "",
        "seccion_id": "",
        "seccionprovincial_id": "",
        "seccionprovincial_nombre": "",
        "circuito": "",
        "electores_mesas": {},
        "votos_total": 0,
        "votos_tipo": Counter(),
        "fuerzas": Counter(),
        "bloques": Counter(),
    }


def discover_sources():
    sources = []
    for path in sorted(DINE_DIR.rglob("*.csv")):
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            first = next(normalized_reader(handle, path), None)
        if not first:
            raise ValueError(f"{path.name}: archivo sin registros")
        year = norm_text(first.get("ano"))
        election_type = pretty_label(first.get("eleccion_tipo"))
        cargo = pretty_label(first.get("cargo_nombre"))
        cargo_id = norm_text(first.get("cargo_id"))
        election_id = norm_text(first.get("eleccion_id"))
        source_id = slug([year, first.get("eleccion_tipo"), cargo_id or cargo, path.stem])
        label = f"{year} · {election_type} · {cargo}"
        sources.append({
            "id": source_id,
            "year": year,
            "label": label,
            "election_type": election_type,
            "cargo": cargo,
            "cargo_id": cargo_id,
            "election_id": election_id,
            "path": path,
        })
    return sources


def slug(parts):
    text = "_".join(norm_name(part) for part in parts if part)
    text = re.sub(r"[^A-Z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_").lower()


def pretty_label(value):
    text = norm_text(value).lower()
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1].upper() + text[1:]


def read_results(source, circuit_party_lookup, party_codes_by_name):
    buckets = defaultdict(empty_bucket)
    totals = {
        "rows": 0,
        "processed_rows": 0,
        "votes": 0,
        "electors": 0,
        "positive": 0,
        "circuits": 0,
        "groups": Counter(),
        "vote_types": Counter(),
        "duplicates": 0,
        "null_keys": 0,
        "unmatched_circuits": set(),
    }
    seen_rows = set()

    with source["path"].open("r", encoding="utf-8-sig", newline="") as handle:
        for row in normalized_reader(handle, source["path"]):
            totals["rows"] += 1
            key = norm_circuit(row.get("circuito_id"))
            mesa_id = norm_text(row.get("mesa_id"))
            mesa_tipo = norm_text(row.get("mesa_tipo"))
            vote_type_raw = norm_name(row.get("votos_tipo")) or "SIN TIPO"
            vote_type = VOTE_TYPE_ALIASES.get(vote_type_raw, vote_type_raw)
            group_raw = norm_text(row.get("agrupacion_nombre"))
            unique_key = (
                norm_text(row.get("distrito_id")),
                norm_text(row.get("seccion_id")),
                key,
                mesa_id,
                mesa_tipo,
                vote_type,
                norm_text(row.get("agrupacion_id")),
                group_raw,
            )
            if not key or not mesa_id or not norm_text(row.get("seccion_id")):
                totals["null_keys"] += 1
                continue
            if unique_key in seen_rows:
                totals["duplicates"] += 1
                continue
            seen_rows.add(unique_key)
            totals["processed_rows"] += 1

            party_lookup = circuit_party_lookup.get(key, {})
            if not party_lookup:
                totals["unmatched_circuits"].add(key)
            bucket = buckets[key]
            bucket["partido"] = party_lookup.get("name") or title_name(row.get("seccion_nombre"))
            bucket["partido_norm"] = party_lookup.get("key") or party_codes_by_name.get(norm_name(row.get("seccion_nombre"))) or norm_name(row.get("seccion_nombre"))
            bucket["seccion_id"] = norm_text(row.get("seccion_id"))
            bucket["seccionprovincial_id"] = norm_text(row.get("seccionprovincial_id"))
            bucket["seccionprovincial_nombre"] = norm_text(row.get("seccionprovincial_nombre"))
            bucket["circuito"] = key

            mesa_key = (
                norm_text(row.get("distrito_id")),
                norm_text(row.get("seccion_id")),
                key,
                mesa_id,
                mesa_tipo,
            )
            electors = as_int(row.get("mesa_electores"))
            if electors:
                bucket["electores_mesas"][mesa_key] = electors

            votes = as_int(row.get("votos_cantidad"))
            group = norm_group(group_raw)
            bucket["votos_total"] += votes
            bucket["votos_tipo"][vote_type] += votes
            totals["votes"] += votes
            totals["vote_types"][vote_type] += votes

            if vote_type == "POSITIVO" and group:
                bucket["fuerzas"][group_raw] += votes
                totals["groups"][group_raw] += votes
                totals["positive"] += votes
                block = BLOCK_ALIASES.get(group)
                if block:
                    bucket["bloques"][block] += votes

    output = {}
    for key, bucket in buckets.items():
        positive = bucket["votos_tipo"].get("POSITIVO", 0)
        electors = sum(bucket["electores_mesas"].values())
        top_forces = bucket["fuerzas"].most_common()
        winner = top_forces[0] if top_forces else ("", 0)
        runner_up = top_forces[1] if len(top_forces) > 1 else ("", 0)

        output[key] = {
            "key": key,
            "partido": bucket["partido"],
            "partido_norm": bucket["partido_norm"],
            "seccion_id": bucket["seccion_id"],
            "seccionprovincial_id": bucket["seccionprovincial_id"],
            "seccionprovincial_nombre": bucket["seccionprovincial_nombre"],
            "circuito": bucket["circuito"],
            "electores": electors,
            "votantes": bucket["votos_total"],
            "participacion": round_or_none(pct(bucket["votos_total"], electors)),
            "ausentismo": round_or_none(1 - pct(bucket["votos_total"], electors) if electors else None),
            "positivos": positive,
            "blanco": bucket["votos_tipo"].get("EN BLANCO", 0),
            "nulo": bucket["votos_tipo"].get("NULO", 0),
            "impugnado": bucket["votos_tipo"].get("IMPUGNADO", 0),
            "recurrido": bucket["votos_tipo"].get("RECURRIDO", 0),
            "pct_blanco": round_or_none(pct(bucket["votos_tipo"].get("EN BLANCO", 0), bucket["votos_total"])),
            "pct_nulo": round_or_none(pct(bucket["votos_tipo"].get("NULO", 0), bucket["votos_total"])),
            "pct_impugnado": round_or_none(pct(bucket["votos_tipo"].get("IMPUGNADO", 0), bucket["votos_total"])),
            "pct_recurrido": round_or_none(pct(bucket["votos_tipo"].get("RECURRIDO", 0), bucket["votos_total"])),
            "fuerzas": dict(bucket["fuerzas"].most_common()),
            "fuerzas_pct": {name: round_or_none(pct(votes, positive)) for name, votes in bucket["fuerzas"].items()},
            "bloques": dict(bucket["bloques"].most_common()),
            "bloques_pct": {block: round_or_none(pct(votes, positive)) for block, votes in bucket["bloques"].items()},
            "ganador": winner[0],
            "ganador_votos": winner[1],
            "segundo": runner_up[0],
            "segundo_votos": runner_up[1],
            "margen": round_or_none(pct(winner[1] - runner_up[1], positive)),
        }

    totals["electors"] = sum(item["electores"] for item in output.values())
    totals["circuits"] = len(output)
    totals["output_votes"] = sum(item["votantes"] for item in output.values())
    totals["output_positive"] = sum(item["positivos"] for item in output.values())
    totals["force_votes"] = sum(totals["groups"].values())
    totals["unmatched_circuits"] = sorted(totals["unmatched_circuits"], key=lambda value: (len(value), value))
    if totals["null_keys"]:
        raise ValueError(f"{source['path'].name}: {totals['null_keys']} registros con claves territoriales nulas")
    if totals["duplicates"]:
        raise ValueError(f"{source['path'].name}: {totals['duplicates']} registros duplicados en la clave mesa/tipo/fuerza")
    if totals["votes"] != totals["output_votes"]:
        raise ValueError(f"{source['path'].name}: no cierra el total de votos de origen y salida")
    if totals["positive"] != totals["output_positive"] or totals["positive"] != totals["force_votes"]:
        raise ValueError(f"{source['path'].name}: no cierra el total de votos positivos por fuerza")
    return output, totals

def compare_elections(base_data, target_data):
    comparison = {}
    for key in sorted(set(base_data) | set(target_data)):
        base = base_data.get(key)
        target = target_data.get(key)
        row = target or base

        def diff(field):
            if not base or not target:
                return None
            a = base.get(field)
            b = target.get(field)
            return round_or_none(b - a) if a is not None and b is not None else None

        def block_diff(block):
            if not base or not target:
                return None
            return round_or_none((target["bloques_pct"].get(block) or 0) - (base["bloques_pct"].get(block) or 0))

        comparison[key] = {
            "key": key,
            "partido": row["partido"],
            "partido_norm": row["partido_norm"],
            "circuito": row["circuito"],
            "has_base": bool(base),
            "has_target": bool(target),
            "participacion_delta": diff("participacion"),
            "ausentismo_delta": diff("ausentismo"),
            "blanco_delta": diff("pct_blanco"),
            "nulo_delta": diff("pct_nulo"),
            "margen_delta": diff("margen"),
            "lla_delta": block_diff("LLA"),
            "peronismo_k_delta": block_diff("PERONISMO_K"),
            "winner_changed": base.get("ganador") != target.get("ganador") if base and target else None,
        }
    return comparison


def aggregate_party(circuits):
    parties = defaultdict(lambda: {
        "key": "",
        "partido": "",
        "partido_norm": "",
        "electores": 0,
        "votantes": 0,
        "positivos": 0,
        "blanco": 0,
        "nulo": 0,
        "bloques": Counter(),
        "fuerzas": Counter(),
        "circuit_count": 0,
    })
    for row in circuits.values():
        party = parties[row["partido_norm"]]
        party["key"] = row["partido_norm"]
        party["partido"] = row["partido"]
        party["partido_norm"] = row["partido_norm"]
        party["electores"] += row["electores"] or 0
        party["votantes"] += row["votantes"] or 0
        party["positivos"] += row["positivos"] or 0
        party["blanco"] += row["blanco"] or 0
        party["nulo"] += row["nulo"] or 0
        party["impugnado"] = party.get("impugnado", 0) + (row.get("impugnado") or 0)
        party["recurrido"] = party.get("recurrido", 0) + (row.get("recurrido") or 0)
        party["bloques"].update(row["bloques"])
        party["fuerzas"].update(row["fuerzas"])
        party["circuit_count"] += 1

    output = {}
    for key, row in parties.items():
        row["bloques"] = dict(row["bloques"].most_common())
        row["fuerzas"] = dict(row["fuerzas"].most_common())
        row["participacion"] = round_or_none(pct(row["votantes"], row["electores"]))
        row["ausentismo"] = round_or_none(1 - pct(row["votantes"], row["electores"]) if row["electores"] else None)
        row["pct_blanco"] = round_or_none(pct(row["blanco"], row["votantes"]))
        row["pct_nulo"] = round_or_none(pct(row["nulo"], row["votantes"]))
        row["pct_impugnado"] = round_or_none(pct(row.get("impugnado", 0), row["votantes"]))
        row["pct_recurrido"] = round_or_none(pct(row.get("recurrido", 0), row["votantes"]))
        row["bloques_pct"] = {block: round_or_none(pct(votes, row["positivos"])) for block, votes in row["bloques"].items()}
        top_forces = sorted(row["fuerzas"].items(), key=lambda item: item[1], reverse=True)
        winner = top_forces[0] if top_forces else ("", 0)
        runner_up = top_forces[1] if len(top_forces) > 1 else ("", 0)
        row["ganador"] = winner[0]
        row["ganador_votos"] = winner[1]
        row["segundo"] = runner_up[0]
        row["segundo_votos"] = runner_up[1]
        row["margen"] = round_or_none(pct(winner[1] - runner_up[1], row["positivos"]))
        output[key] = row
    return output


def aggregate_locality(circuits, locality_lookup):
    localities = defaultdict(lambda: {
        "key": "",
        "clc": "",
        "localidad": "",
        "localidad_norm": "",
        "partido": "",
        "partido_norm": "",
        "electores": 0,
        "votantes": 0,
        "positivos": 0,
        "blanco": 0,
        "nulo": 0,
        "impugnado": 0,
        "recurrido": 0,
        "bloques": Counter(),
        "fuerzas": Counter(),
        "circuit_count": 0,
    })
    for circuit_key, row in circuits.items():
        locality_info = locality_lookup.get(circuit_key)
        if not locality_info:
            continue
        locality = localities[locality_info["key"]]
        locality.update({
            "key": locality_info["key"],
            "clc": locality_info["clc"],
            "localidad": locality_info["localidad"],
            "localidad_norm": locality_info["localidad_norm"],
            "partido": locality_info["partido"],
            "partido_norm": locality_info["partido_norm"],
        })
        for field in ("electores", "votantes", "positivos", "blanco", "nulo", "impugnado", "recurrido"):
            locality[field] += row.get(field) or 0
        locality["bloques"].update(row["bloques"])
        locality["fuerzas"].update(row["fuerzas"])
        locality["circuit_count"] += 1

    output = {}
    for key, row in localities.items():
        row["bloques"] = dict(row["bloques"].most_common())
        row["fuerzas"] = dict(row["fuerzas"].most_common())
        row["participacion"] = round_or_none(pct(row["votantes"], row["electores"]))
        row["ausentismo"] = round_or_none(1 - pct(row["votantes"], row["electores"]) if row["electores"] else None)
        row["pct_blanco"] = round_or_none(pct(row["blanco"], row["votantes"]))
        row["pct_nulo"] = round_or_none(pct(row["nulo"], row["votantes"]))
        row["pct_impugnado"] = round_or_none(pct(row["impugnado"], row["votantes"]))
        row["pct_recurrido"] = round_or_none(pct(row["recurrido"], row["votantes"]))
        row["bloques_pct"] = {block: round_or_none(pct(votes, row["positivos"])) for block, votes in row["bloques"].items()}
        top_forces = sorted(row["fuerzas"].items(), key=lambda item: item[1], reverse=True)
        winner = top_forces[0] if top_forces else ("", 0)
        runner_up = top_forces[1] if len(top_forces) > 1 else ("", 0)
        row["ganador"] = winner[0]
        row["ganador_votos"] = winner[1]
        row["segundo"] = runner_up[0]
        row["segundo_votos"] = runner_up[1]
        row["margen"] = round_or_none(pct(winner[1] - runner_up[1], row["positivos"]))
        output[key] = row
    return output


def ring_signed_area(points):
    return sum(
        points[index][0] * points[index + 1][1] - points[index + 1][0] * points[index][1]
        for index in range(len(points) - 1)
    ) / 2


def clean_ring_spikes(ring, loop_area_epsilon=1e-9):
    points = [list(point) for point in ring]
    changed = False
    while len(points) >= 4:
        positions = {}
        removed = False
        for index, point in enumerate(points):
            coordinate = tuple(point[:2])
            if coordinate not in positions:
                positions[coordinate] = index
                continue
            previous = positions[coordinate]
            if previous == 0 and index == len(points) - 1:
                continue
            loop = points[previous:index + 1]
            if len(loop) >= 3 and abs(ring_signed_area(loop)) <= loop_area_epsilon:
                points = points[:previous + 1] + points[index + 1:]
                changed = removed = True
                break
        if not removed:
            break
    if len(points) < 4:
        return None, True
    if points[0][:2] != points[-1][:2]:
        points.append(points[0])
        changed = True
    if abs(ring_signed_area(points)) <= 1e-12:
        return None, True
    return points, changed


def clean_polygon_geometry(geometry):
    if not geometry or geometry.get("type") not in {"Polygon", "MultiPolygon"}:
        return geometry, False
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    cleaned_polygons = []
    changed = False
    for polygon in polygons:
        if not polygon:
            changed = True
            continue
        exterior, exterior_changed = clean_ring_spikes(polygon[0])
        changed = changed or exterior_changed
        if not exterior:
            continue
        rings = [exterior]
        for hole in polygon[1:]:
            cleaned_hole, hole_changed = clean_ring_spikes(hole)
            changed = changed or hole_changed
            if cleaned_hole:
                rings.append(cleaned_hole)
        cleaned_polygons.append(rings)
    if not cleaned_polygons:
        raise ValueError("La limpieza geométrica eliminó todos los polígonos de una feature")
    if geometry["type"] == "Polygon":
        if len(cleaned_polygons) != 1:
            raise ValueError("Una geometría Polygon produjo más de un polígono al limpiarse")
        return {"type": "Polygon", "coordinates": cleaned_polygons[0]}, changed
    return {"type": "MultiPolygon", "coordinates": cleaned_polygons}, changed


def slim_circuit_geojson(metrics, locality_lookup):
    valid_party_codes, party_codes_by_name = load_party_lookup()
    with CIRCUIT_GEOJSON.open("r", encoding="utf-8") as handle:
        geo = json.load(handle)
    for feature in geo.get("features", []):
        props = feature.get("properties", {}) or {}
        key = norm_circuit(props.get("circuito"))
        party_key = party_code(props) or resolve_party_key(props.get("indec_p"), props.get("indec_d"), props.get("departamen"), valid_party_codes, party_codes_by_name)
        locality = locality_lookup.get(key, {})
        geometry_repaired = key in KNOWN_GEOMETRY_REPAIRS["circuit"]
        if geometry_repaired:
            feature["geometry"], _ = clean_polygon_geometry(feature.get("geometry"))
        feature["properties"] = {
            "key": key,
            "partido": title_name(props.get("departamen")),
            "partido_norm": party_key,
            "circuito": norm_circuit(props.get("circuito")),
            "indec_p": norm_code(props.get("indec_p"), 2),
            "indec_d": props.get("indec_d"),
            "cde": party_key,
            "localidad_key": locality.get("key"),
            "localidad_clc": locality.get("clc"),
            "localidad": locality.get("localidad"),
            "localidad_estado": locality.get("status"),
            "localidad_metodo": locality.get("method"),
            "localidad_confianza": locality.get("confidence"),
            "localidad_peso_poblacional": locality.get("dominant_population_share"),
            "localidad_candidatas": locality.get("candidate_count"),
            "localidad_relaciones": locality.get("relations", []),
            "geometry_repaired": geometry_repaired,
            "has_data": key in metrics,
        }
    return geo


def slim_locality_geojson(locality_keys, locality_lookup):
    nomenclator, _ = load_nomenclator(LOCALITY_NOMENCLATOR)
    with LOCALITY_GEOJSON.open("r", encoding="utf-8") as handle:
        geo = json.load(handle)

    primary_counts = Counter()
    related_counts = Counter()
    for locality in locality_lookup.values():
        if locality.get("clc"):
            primary_counts[locality["clc"]] += 1
        for relation in locality.get("relations", []):
            if relation.get("clc"):
                related_counts[relation["clc"]] += 1

    seen = set()
    for feature in geo.get("features", []):
        props = feature.get("properties", {}) or {}
        clc = norm_text(props.get("clc"))
        official = nomenclator.get(clc)
        if not official:
            raise ValueError(f"Geometría de localidad sin nomenclador oficial: {clc}")
        if clc in seen:
            raise ValueError(f"CLC duplicado en la capa de localidades: {clc}")
        seen.add(clc)
        geometry_repaired = clc in KNOWN_GEOMETRY_REPAIRS["locality"]
        if geometry_repaired:
            feature["geometry"], _ = clean_polygon_geometry(feature.get("geometry"))
        feature["properties"] = {
            "key": clc,
            "localidad_key": clc,
            "clc": clc,
            "localidad": official["name"],
            "partido_norm": official["party_code"],
            "partido": official["party_name"],
            "cde": official["party_code"],
            "has_electoral_data": clc in locality_keys,
            "primary_circuit_count": primary_counts.get(clc, 0),
            "related_circuit_count": related_counts.get(clc, 0),
            "secondary_only": primary_counts.get(clc, 0) == 0 and related_counts.get(clc, 0) > 0,
            "geometry_repaired": geometry_repaired,
        }
    if seen != set(nomenclator):
        raise ValueError(
            f"No cierra el universo geométrico de localidades: geometrías={len(seen)}, nomenclador={len(nomenclator)}"
        )
    return geo


def slim_party_geojson(party_keys):
    with PARTY_GEOJSON.open("r", encoding="utf-8") as handle:
        geo = json.load(handle)
    for feature in geo.get("features", []):
        props = feature.get("properties", {}) or {}
        key = party_code(props)
        geometry_repaired = key in KNOWN_GEOMETRY_REPAIRS["party"]
        if geometry_repaired:
            feature["geometry"], _ = clean_polygon_geometry(feature.get("geometry"))
        feature["properties"] = {
            "key": key,
            "partido": party_name(props) or title_name(key),
            "partido_norm": key,
            "cde": key,
            "geometry_repaired": geometry_repaired,
            "has_data": key in party_keys,
        }
    geo["features"] = [feature for feature in geo.get("features", []) if feature["properties"]["has_data"]]
    return geo


def load_party_lookup():
    with PARTY_GEOJSON.open("r", encoding="utf-8") as handle:
        geo = json.load(handle)
    codes = set()
    by_name = {}
    for feature in geo.get("features", []):
        props = feature.get("properties", {}) or {}
        code = party_code(props)
        if not code:
            continue
        codes.add(code)
        by_name.setdefault(norm_name(party_name(props)), code)
    return codes, by_name


def load_locality_lookup(circuit_party_lookup):
    assignments, report = derive_assignments(DATA_ROOT, circuit_party_lookup, LOCALITY_NOMENCLATOR)
    lookup = {}
    locality_keys = set()
    party_localities = Counter()
    for circuit, assignment in assignments.items():
        clc = assignment.get("assigned_clc")
        locality = assignment.get("assigned_name")
        if not clc or not locality:
            continue
        lookup[circuit] = {
            "key": clc,
            "clc": clc,
            "localidad": locality,
            "localidad_norm": slug([locality]),
            "partido": assignment["party_name"],
            "partido_norm": assignment["party_code"],
            "status": assignment["status"],
            "method": assignment["method"],
            "confidence": assignment["confidence"],
            "dominant_population_share": assignment["dominant_population_share"],
            "candidate_count": assignment["candidate_count"],
            "relations": [
                {
                    "clc": candidate["clc"],
                    "localidad": candidate["name"],
                    "rol": "principal" if candidate["clc"] == clc else "secundaria",
                    "radio_count": candidate["radio_count"],
                    "population": candidate["population"],
                    "population_share": round_or_none(candidate["population_share"]),
                }
                for candidate in assignment.get("candidates", [])
            ],
        }
        locality_keys.add(clc)
        party_localities[assignment["party_code"]] += 1

    blank_locality = [circuit for circuit, row in assignments.items() if not row.get("assigned_clc")]
    summary = report["summary"]
    return lookup, {
        "source": "Radios_con_Localidades.dbf + Circuitos_Radios_uno_a_muchos.xlsx + población CNPHV 2022",
        "source_rows": len(assignments),
        "mapped_circuits": len(lookup),
        "blank_locality_circuits": sorted(blank_locality, key=lambda value: (len(value), value)),
        "localities": len(locality_keys),
        "party_locality_pairs": len(locality_keys),
        "parties_with_localities": len(party_localities),
        "cartography": "official_locality_polygons",
        "key": "CLC de ocho dígitos",
        "assignment_method": report["methodology"],
        "classification": summary["status_counts"],
        "confidence": summary["confidence_counts"],
        "official_localities": summary["official_localities"],
        "official_localities_without_primary_circuit": summary["official_localities_without_primary_circuit"],
        "radio_circuit_cross_party": summary["radio_circuit_cross_party"],
    }

def build_circuit_party_lookup():
    valid_party_codes, party_codes_by_name = load_party_lookup()
    with CIRCUIT_GEOJSON.open("r", encoding="utf-8") as handle:
        geo = json.load(handle)
    lookup = {}
    for feature in geo.get("features", []):
        props = feature.get("properties", {}) or {}
        circuit = norm_circuit(props.get("circuito"))
        party_key = party_code(props) or resolve_party_key(props.get("indec_p"), props.get("indec_d"), props.get("departamen"), valid_party_codes, party_codes_by_name)
        lookup[circuit] = {"key": party_key, "name": title_name(props.get("departamen"))}
    return lookup


def parse_args():
    parser = argparse.ArgumentParser(description="Construye los datos estáticos del Atlas Electoral PBA")
    parser.add_argument("--data-root", default=str(DATA_ROOT), help="Raíz externa que contiene 01_DINE y las capas")
    parser.add_argument("--output-dir", help="Directorio de salida; por defecto usa data/ del repositorio")
    return parser.parse_args()


def main():
    args = parse_args()
    configure_paths(args.data_root, args.output_dir)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    sources = discover_sources()
    _, party_codes_by_name = load_party_lookup()
    circuit_party_lookup = build_circuit_party_lookup()
    locality_lookup, locality_meta = load_locality_lookup(circuit_party_lookup)
    circuit_elections = {}
    locality_elections = {}
    party_elections = {}
    source_meta = []

    for source in sources:
      data, totals = read_results(source, circuit_party_lookup, party_codes_by_name)
      circuit_elections[source["id"]] = data
      locality_elections[source["id"]] = aggregate_locality(data, locality_lookup)
      party_elections[source["id"]] = aggregate_party(data)
      source_meta.append({
          "id": source["id"],
          "year": source["year"],
          "label": source["label"],
          "election_type": source["election_type"],
          "cargo": source["cargo"],
          "path": str(source["path"].relative_to(DATA_ROOT)),
          "rows": totals["rows"],
          "processed_rows": totals["processed_rows"],
          "votes": totals["votes"],
          "electors": totals["electors"],
          "positive": totals["positive"],
          "circuits": totals["circuits"],
          "duplicates": totals["duplicates"],
          "null_keys": totals["null_keys"],
          "unmatched_circuits": totals["unmatched_circuits"],
          "vote_types": dict(totals["vote_types"].most_common()),
          "top_groups": dict(totals["groups"].most_common(20)),
      })

    default_base = next((source["id"] for source in source_meta if source["year"] == "2023" and "Presidente" in source["cargo"] and "Segunda" not in source["election_type"]), source_meta[0]["id"])
    default_target = next((source["id"] for source in source_meta if source["year"] == "2025"), source_meta[-1]["id"])

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "mode": "csv",
        "blocks": BLOCK_LABELS,
        "sources": source_meta,
        "defaults": {"base": default_base, "target": default_target},
        "territory_metadata": {"locality": locality_meta},
        "circuit": {"elections": circuit_elections},
        "locality": {"elections": locality_elections},
        "party": {"elections": party_elections},
    }

    all_circuit_keys = set().union(*(set(data) for data in circuit_elections.values()))
    all_locality_keys = set().union(*(set(data) for data in locality_elections.values()))
    all_party_keys = set().union(*(set(data) for data in party_elections.values()))

    (DATA_DIR / "electoral_data.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA_DIR / "circuitos_pba.geojson").write_text(json.dumps(slim_circuit_geojson(all_circuit_keys, locality_lookup), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA_DIR / "localidades_pba_mas2000.geojson").write_text(json.dumps(slim_locality_geojson(all_locality_keys, locality_lookup), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA_DIR / "partidos_pba.geojson").write_text(json.dumps(slim_party_geojson(all_party_keys), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(DATA_DIR / "electoral_data.json")
    print(f"{len(source_meta)} elecciones CSV procesadas")


if __name__ == "__main__":
    main()
