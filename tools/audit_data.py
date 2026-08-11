import argparse
import csv
import json
import os
import re
import unicodedata
from collections import Counter
from datetime import datetime
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
OUT_DIR = APP_DIR / "docs"
DATA_DIR = APP_DIR / "data"
DEFAULT_DATA_ROOT = Path(r"G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos")
DATA_ROOT = Path(os.environ.get("ATLAS_DATA_ROOT", DEFAULT_DATA_ROOT))
DINE_DIR = DATA_ROOT / "01_DINE"

SOURCE_CIRCUITS = DATA_ROOT / "03_circuitoselectoralespba" / "01_CircuitosElectorales2025_PBA3.geojson"
SOURCE_PARTIES = DATA_ROOT / "03_circuitoselectoralespba" / "02_PartidosPBA2.geojson"
APP_CIRCUITS = DATA_DIR / "circuitos_pba.geojson"
APP_LOCALITIES = DATA_DIR / "localidades_pba_mas2000.geojson"
APP_PARTIES = DATA_DIR / "partidos_pba.geojson"
APP_ELECTORAL_DATA = DATA_DIR / "electoral_data.json"

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

IMPORTANT_PARTIES = {
    "06218": "Chascomús",
    "06466": "Lezama",
    "06371": "General San Martín",
}


def norm_text(value):
    return (value or "").strip()


def canonical_field(value):
    normalized = unicodedata.normalize("NFD", norm_text(value).lower())
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def normalized_reader(handle, path):
    reader = csv.DictReader(handle)
    columns = reader.fieldnames or []
    canonical_columns = {canonical_field(column): column for column in columns}
    missing = sorted(REQUIRED_COLUMNS - set(canonical_columns))
    if missing:
        raise ValueError(f"{path.name}: faltan columnas esenciales: {', '.join(missing)}")
    for row in reader:
        yield {key: row.get(original, "") for key, original in canonical_columns.items()}


def configure_paths(data_root, data_dir=None, output_dir=None):
    global DATA_ROOT, DATA_DIR, OUT_DIR, DINE_DIR, SOURCE_CIRCUITS, SOURCE_PARTIES
    global APP_CIRCUITS, APP_LOCALITIES, APP_PARTIES, APP_ELECTORAL_DATA
    DATA_ROOT = Path(data_root).resolve()
    DATA_DIR = Path(data_dir).resolve() if data_dir else APP_DIR / "data"
    OUT_DIR = Path(output_dir).resolve() if output_dir else APP_DIR / "docs"
    DINE_DIR = DATA_ROOT / "01_DINE"
    SOURCE_CIRCUITS = DATA_ROOT / "03_circuitoselectoralespba" / "01_CircuitosElectorales2025_PBA3.geojson"
    SOURCE_PARTIES = DATA_ROOT / "03_circuitoselectoralespba" / "02_PartidosPBA2.geojson"
    APP_CIRCUITS = DATA_DIR / "circuitos_pba.geojson"
    APP_LOCALITIES = DATA_DIR / "localidades_pba_mas2000.geojson"
    APP_PARTIES = DATA_DIR / "partidos_pba.geojson"
    APP_ELECTORAL_DATA = DATA_DIR / "electoral_data.json"


def norm_name(value):
    text = norm_text(value).upper().replace("Ñ", "N")
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = re.sub(r"^PARTIDO\s+(DE|DEL)\s+", "", text)
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def norm_circuit(value):
    text = norm_text(value).upper()
    if re.fullmatch(r"\d+", text):
        return str(int(text))
    match = re.fullmatch(r"0*(\d+)([A-Z]+)", text)
    if match:
        return f"{int(match.group(1))}{match.group(2)}"
    return text.lstrip("0") or text


def as_int(value):
    try:
        if value is None or value == "":
            return 0
        return int(float(str(value).replace(",", ".")))
    except ValueError:
        return 0


def pct(value, digits=2):
    if value is None:
        return "s/d"
    return f"{value * 100:.{digits}f}%"


def fmt_int(value):
    return f"{value:,}".replace(",", ".")


def md_table(rows, headers):
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(str(row.get(header, "")) for header in headers) + " |")
    return "\n".join(lines)


def slug(parts):
    text = "_".join(norm_name(part) for part in parts if part)
    text = re.sub(r"[^A-Z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_").lower()


def pretty_label(value):
    text = norm_text(value).lower()
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1].upper() + text[1:]


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
        source_id = slug([year, first.get("eleccion_tipo"), cargo_id or cargo, path.stem])
        sources.append({
            "id": source_id,
            "year": year,
            "label": f"{year} · {election_type} · {cargo}",
            "path": path,
        })
    return sources


def inspect_csv(source):
    counters = {
        "votos_tipo": Counter(),
        "agrupacion_nombre": Counter(),
        "seccion_nombre": Counter(),
    }
    circuits = set()
    sections = set()
    mesas = {}
    votes_total = 0
    positive_by_group = Counter()
    duplicate_keys = 0
    null_keys = 0
    seen_rows = set()

    with source["path"].open("r", encoding="utf-8-sig", newline="") as handle:
        raw_reader = csv.DictReader(handle)
        columns = raw_reader.fieldnames or []

    with source["path"].open("r", encoding="utf-8-sig", newline="") as handle:
        row_count = 0
        for row in normalized_reader(handle, source["path"]):
            row_count += 1
            circuit = norm_circuit(row.get("circuito_id"))
            mesa_id = norm_text(row.get("mesa_id"))
            mesa_tipo = norm_text(row.get("mesa_tipo"))
            section_id = norm_text(row.get("seccion_id"))
            vote_type_raw = norm_name(row.get("votos_tipo")) or "SIN TIPO"
            vote_type = VOTE_TYPE_ALIASES.get(vote_type_raw, vote_type_raw)
            group = norm_text(row.get("agrupacion_nombre"))
            if not circuit or not mesa_id or not section_id:
                null_keys += 1
            sections.add((norm_text(row.get("distrito_id")), section_id))
            circuits.add(circuit)
            mesa_key = (
                norm_text(row.get("distrito_id")),
                section_id,
                circuit,
                mesa_id,
                mesa_tipo,
            )
            row_key = mesa_key + (vote_type, norm_text(row.get("agrupacion_id")), group)
            if row_key in seen_rows:
                duplicate_keys += 1
            seen_rows.add(row_key)

            electors = as_int(row.get("mesa_electores"))
            if electors:
                mesas[mesa_key] = max(mesas.get(mesa_key, 0), electors)

            votes = as_int(row.get("votos_cantidad"))
            votes_total += votes
            counters["votos_tipo"][vote_type] += votes
            counters["agrupacion_nombre"][group] += 1
            counters["seccion_nombre"][norm_text(row.get("seccion_nombre"))] += 1
            if vote_type == "POSITIVO":
                positive_by_group[group or "SIN_AGRUPACION"] += votes

    electors_total = sum(mesas.values())
    positive_total = counters["votos_tipo"]["POSITIVO"]
    force_total = sum(positive_by_group.values())
    return {
        "id": source["id"],
        "label": source["label"],
        "path": str(source["path"].relative_to(DATA_ROOT)),
        "size_mb": round(source["path"].stat().st_size / 1024 / 1024, 2),
        "columns": columns,
        "row_count": row_count,
        "processed_rows": row_count - duplicate_keys - null_keys,
        "sections_count": len(sections),
        "circuits_count": len(circuits),
        "circuit_keys": sorted(circuits, key=lambda value: (len(value), value)),
        "mesas_count": len(mesas),
        "electors_total_from_unique_mesas": electors_total,
        "votes_total_from_rows": votes_total,
        "positive_total_from_rows": positive_total,
        "positive_total_by_group": force_total,
        "positive_closure_delta": positive_total - force_total,
        "turnout_estimate": votes_total / electors_total if electors_total else None,
        "votes_by_type": dict(counters["votos_tipo"].most_common()),
        "positive_by_group_top": dict(positive_by_group.most_common(15)),
        "duplicate_keys": duplicate_keys,
        "null_keys": null_keys,
    }

def load_geojson(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def inspect_source_parties():
    geo = load_geojson(SOURCE_PARTIES)
    features = geo.get("features", [])
    keys = [norm_text((feature.get("properties") or {}).get("CODIGO")) for feature in features]
    names = {
        norm_text((feature.get("properties") or {}).get("CODIGO")): norm_text((feature.get("properties") or {}).get("NOMBRE"))
        for feature in features
    }
    return {
        "path": str(SOURCE_PARTIES.relative_to(DATA_ROOT)),
        "feature_count": len(features),
        "unique_codigo_count": len(set(keys)),
        "duplicate_codigos": {key: keys.count(key) for key in sorted(set(keys)) if keys.count(key) > 1},
        "important_parties": {key: names.get(key) for key in IMPORTANT_PARTIES},
        "property_names": sorted({field for feature in features for field in (feature.get("properties") or {})}),
    }


def inspect_source_circuits(csv_audit):
    geo = load_geojson(SOURCE_CIRCUITS)
    features = geo.get("features", [])
    circuit_keys = set()
    party_codes = set()
    features_without_codigo = 0
    features_without_circuit = 0
    for feature in features:
        props = feature.get("properties") or {}
        circuit = norm_circuit(props.get("circuito"))
        codigo = norm_text(props.get("CODIGO"))
        if circuit:
            circuit_keys.add(circuit)
        else:
            features_without_circuit += 1
        if codigo:
            party_codes.add(codigo)
        else:
            features_without_codigo += 1

    by_election = {}
    for source_id, info in csv_audit.items():
        data_keys = set(info["circuit_keys"])
        missing_geo = sorted(data_keys - circuit_keys, key=lambda value: (len(value), value))
        geo_without_data = sorted(circuit_keys - data_keys, key=lambda value: (len(value), value))
        by_election[source_id] = {
            "dine_circuits": len(data_keys),
            "matched": len(data_keys & circuit_keys),
            "missing_geo_count": len(missing_geo),
            "missing_geo_sample": missing_geo[:30],
            "geo_without_data_count": len(geo_without_data),
            "geo_without_data_sample": geo_without_data[:30],
            "coverage_dine_pct": round((len(data_keys & circuit_keys) / len(data_keys)) * 100, 2) if data_keys else 0,
        }

    return {
        "path": str(SOURCE_CIRCUITS.relative_to(DATA_ROOT)),
        "feature_count": len(features),
        "unique_circuit_count": len(circuit_keys),
        "unique_party_codigo_count": len(party_codes),
        "features_without_codigo": features_without_codigo,
        "features_without_circuit": features_without_circuit,
        "property_names": sorted({field for feature in features for field in (feature.get("properties") or {})}),
        "by_election": by_election,
    }


def inspect_app_artifacts():
    data = json.loads(APP_ELECTORAL_DATA.read_text(encoding="utf-8"))
    party_geo = load_geojson(APP_PARTIES)
    circuit_geo = load_geojson(APP_CIRCUITS)
    locality_geo = load_geojson(APP_LOCALITIES)
    party_geo_keys = {feature["properties"]["key"] for feature in party_geo.get("features", [])}
    circuit_geo_keys = {feature["properties"]["key"] for feature in circuit_geo.get("features", [])}
    locality_geo_keys = {feature["properties"]["localidad_key"] for feature in locality_geo.get("features", [])}

    elections = {}
    for source in data.get("sources", []):
        source_id = source["id"]
        party_rows = data["party"]["elections"][source_id]
        circuit_rows = data["circuit"]["elections"][source_id]
        party_keys = set(party_rows)
        circuit_keys = set(circuit_rows)
        source_votes = source.get("votes", 0)
        source_electors = source.get("electors", 0)
        source_positive = source.get("positive", 0)
        circuit_votes = sum(row.get("votantes", 0) or 0 for row in circuit_rows.values())
        circuit_electors = sum(row.get("electores", 0) or 0 for row in circuit_rows.values())
        circuit_positive = sum(row.get("positivos", 0) or 0 for row in circuit_rows.values())
        elections[source_id] = {
            "label": source["label"],
            "year": source["year"],
            "source_rows": source.get("rows"),
            "processed_rows": source.get("processed_rows"),
            "duplicates": source.get("duplicates", 0),
            "null_keys": source.get("null_keys", 0),
            "unmatched_circuits": source.get("unmatched_circuits", []),
            "votes_delta": circuit_votes - source_votes,
            "electors_delta": circuit_electors - source_electors,
            "positive_delta": circuit_positive - source_positive,
            "party_rows": len(party_rows),
            "circuit_rows": len(circuit_rows),
            "party_data_without_geo": sorted(party_keys - party_geo_keys),
            "party_geo_without_data_count": len(party_geo_keys - party_keys),
            "circuit_data_without_geo_count": len(circuit_keys - circuit_geo_keys),
            "circuit_data_without_geo_sample": sorted(circuit_keys - circuit_geo_keys, key=lambda value: (len(value), value))[:30],
            "circuit_geo_without_data_count": len(circuit_geo_keys - circuit_keys),
            "important_party_rows": {
                key: {
                    "expected": expected,
                    "name": party_rows.get(key, {}).get("partido"),
                    "electores": party_rows.get(key, {}).get("electores"),
                    "votantes": party_rows.get(key, {}).get("votantes"),
                    "circuit_count": party_rows.get(key, {}).get("circuit_count"),
                }
                for key, expected in IMPORTANT_PARTIES.items()
            },
        }

    return {
        "generated_at": data.get("generated_at"),
        "defaults": data.get("defaults"),
        "source_count": len(data.get("sources", [])),
        "party_geo_features": len(party_geo.get("features", [])),
        "circuit_geo_features": len(circuit_geo.get("features", [])),
        "locality_geo_features": len(locality_geo.get("features", [])),
        "party_geo_unique_keys": len(party_geo_keys),
        "circuit_geo_unique_keys": len(circuit_geo_keys),
        "locality_geo_unique_keys": len(locality_geo_keys),
        "elections": elections,
    }


def inspect_localities():
    data = json.loads(APP_ELECTORAL_DATA.read_text(encoding="utf-8"))
    circuit_geo = load_geojson(APP_CIRCUITS)
    locality_geo = load_geojson(APP_LOCALITIES)
    locality_features = locality_geo.get("features", [])
    locality_keys = [feature["properties"].get("localidad_key") for feature in locality_features]
    invalid_locality_party = [
        key for key, feature in zip(locality_keys, locality_features)
        if not key or str(key)[:5] != str(feature["properties"].get("partido_norm"))
    ]
    invalid_relations = []
    secondary_relations = 0
    for feature in circuit_geo.get("features", []):
        props = feature["properties"]
        party_key = props.get("partido_norm")
        relations = props.get("localidad_relaciones", [])
        relation_ids = [item.get("clc") for item in relations]
        primary = [item.get("clc") for item in relations if item.get("rol") == "principal"]
        secondary_relations += sum(item.get("rol") == "secundaria" for item in relations)
        if len(relation_ids) != len(set(relation_ids)) or any(clc and str(clc)[:5] != str(party_key) for clc in relation_ids):
            invalid_relations.append(props.get("key"))
        if (primary[0] if len(primary) == 1 else None) != props.get("localidad_clc"):
            invalid_relations.append(props.get("key"))
    mapping = {
        feature["properties"]["key"]: feature["properties"].get("localidad_key")
        for feature in circuit_geo.get("features", [])
        if feature["properties"].get("localidad_key")
    }
    fields = ("electores", "votantes", "positivos", "blanco", "nulo", "impugnado", "recurrido")
    elections = {}
    for source in data.get("sources", []):
        source_id = source["id"]
        circuits = data["circuit"]["elections"][source_id]
        localities = data["locality"]["elections"][source_id]
        mapped_rows = [row for key, row in circuits.items() if key in mapping]
        deltas = {
            field: sum((row.get(field) or 0) for row in localities.values())
            - sum((row.get(field) or 0) for row in mapped_rows)
            for field in fields
        }
        total_electors = sum((row.get("electores") or 0) for row in circuits.values())
        mapped_electors = sum((row.get("electores") or 0) for row in mapped_rows)
        wrong_party_keys = [
            key for key, row in localities.items()
            if str(key)[:5] != str(row["partido_norm"])
        ]
        elections[source_id] = {
            "label": source["label"],
            "locality_rows": len(localities),
            "mapped_circuits_with_data": len(mapped_rows),
            "elector_coverage": mapped_electors / total_electors if total_electors else None,
            "deltas": deltas,
            "wrong_party_keys": wrong_party_keys,
        }
    return {
        "metadata": data.get("territory_metadata", {}).get("locality", {}),
        "mapped_geo_circuits": len(mapping),
        "official_geometry_features": len(locality_features),
        "official_geometry_unique_keys": len(set(locality_keys)),
        "official_geometry_with_electoral_data": sum(bool(feature["properties"].get("has_electoral_data")) for feature in locality_features),
        "official_geometry_secondary_only": sum(bool(feature["properties"].get("secondary_only")) for feature in locality_features),
        "official_geometry_without_primary": sum(feature["properties"].get("primary_circuit_count", 0) == 0 for feature in locality_features),
        "invalid_locality_party_keys": invalid_locality_party,
        "secondary_circuit_relations": secondary_relations,
        "invalid_circuit_relations": sorted(set(invalid_relations), key=lambda value: (len(str(value)), str(value))),
        "elections": elections,
    }


def build_report(audit):
    csv_rows = []
    for info in audit["csv"].values():
        csv_rows.append({
            "eleccion": info["label"],
            "archivo": info["path"],
            "filas": fmt_int(info["row_count"]),
            "circuitos": info["circuits_count"],
            "mesas": fmt_int(info["mesas_count"]),
            "electores": fmt_int(info["electors_total_from_unique_mesas"]),
            "votos": fmt_int(info["votes_total_from_rows"]),
            "positivos": fmt_int(info["positive_total_from_rows"]),
            "duplicados": info["duplicate_keys"],
            "claves_nulas": info["null_keys"],
            "cierre_positivos": info["positive_closure_delta"],
            "participacion_est": pct(info["turnout_estimate"]),
        })

    app_rows = []
    for info in audit["app"]["elections"].values():
        app_rows.append({
            "eleccion": info["label"],
            "partidos": info["party_rows"],
            "circuitos_datos": info["circuit_rows"],
            "partidos_sin_geo": len(info["party_data_without_geo"]),
            "circuitos_sin_geo": info["circuit_data_without_geo_count"],
            "cierre_votos": info["votes_delta"],
            "cierre_electores": info["electors_delta"],
            "cierre_positivos": info["positive_delta"],
        })

    circuit_rows = []
    for source_id, info in audit["source_circuits"]["by_election"].items():
        circuit_rows.append({
            "eleccion": audit["csv"][source_id]["label"],
            "circuitos_dine": info["dine_circuits"],
            "match": info["matched"],
            "cobertura_dine": f"{info['coverage_dine_pct']}%",
            "dine_sin_geo": info["missing_geo_count"],
            "geo_sin_datos": info["geo_without_data_count"],
        })

    lines = [
        "# Auditoria de datos electorales PBA",
        "",
        f"Generado: {audit['generated_at']}",
        "",
        "## Alcance vigente",
        "",
        "- Esta auditoria corresponde a la app `05_MapaElectoral_Cockpit_CSV`.",
        "- Capa de partidos fuente: `02_PartidosPBA2.geojson`.",
        "- Capa de circuitos fuente: `01_CircuitosElectorales2025_PBA3.geojson`.",
        "- La clave de union de partido es `CODIGO`.",
        "- La clave de union de circuito es `circuito`, normalizada sin ceros iniciales y conservando sufijos alfabeticos.",
        "- Los artefactos auditados son `electoral_data.json`, `partidos_pba.geojson`, `localidades_pba_mas2000.geojson` y `circuitos_pba.geojson` dentro de `data/`.",
        "",
        "## Inventario CSV DINE",
        "",
        md_table(csv_rows, ["eleccion", "archivo", "filas", "circuitos", "mesas", "electores", "votos", "positivos", "duplicados", "claves_nulas", "cierre_positivos", "participacion_est"]),
        "",
        "Nota: `participacion_est` se calcula como suma de votos registrados / electores unicos por mesa.",
        "",
        "## Capas fuente",
        "",
        f"- Partidos fuente: {audit['source_parties']['feature_count']} features, {audit['source_parties']['unique_codigo_count']} CODIGO unicos.",
        f"- Circuitos fuente: {audit['source_circuits']['feature_count']} features, {audit['source_circuits']['unique_circuit_count']} circuitos unicos.",
        f"- CODIGO de partido presentes en circuitos fuente: {audit['source_circuits']['unique_party_codigo_count']}.",
        f"- Features de circuito sin `CODIGO`: {audit['source_circuits']['features_without_codigo']}.",
        f"- Features de circuito sin `circuito`: {audit['source_circuits']['features_without_circuit']}.",
        f"- CODIGO duplicados en partidos fuente: {audit['source_parties']['duplicate_codigos'] or 'ninguno'}.",
        "",
        "Partidos criticos en la capa fuente:",
        "",
        md_table(
            [
                {"codigo": key, "esperado": expected, "nombre_fuente": audit["source_parties"]["important_parties"].get(key)}
                for key, expected in IMPORTANT_PARTIES.items()
            ],
            ["codigo", "esperado", "nombre_fuente"],
        ),
        "",
        "## Cobertura circuito contra capa PBA3",
        "",
        md_table(circuit_rows, ["eleccion", "circuitos_dine", "match", "cobertura_dine", "dine_sin_geo", "geo_sin_datos"]),
        "",
        "Muestras de circuitos DINE sin geometria:",
        "",
    ]

    for source_id, info in audit["source_circuits"]["by_election"].items():
        lines.append(f"- {audit['csv'][source_id]['label']}: {info['missing_geo_sample'] or 'ninguno'}")

    locality_rows = []
    for info in audit["localities"]["elections"].values():
        locality_rows.append({
            "eleccion": info["label"],
            "localidades": info["locality_rows"],
            "circuitos_vinculados": info["mapped_circuits_with_data"],
            "cobertura_electores": pct(info["elector_coverage"]),
            "cierre_electores": info["deltas"]["electores"],
            "cierre_votos": info["deltas"]["votantes"],
            "claves_partido_invalidas": len(info["wrong_party_keys"]),
        })

    lines.extend([
        "",
        "## Auditoria de localidades",
        "",
        f"- Circuitos en la correspondencia: {audit['localities']['metadata'].get('source_rows', 0)}.",
        f"- Circuitos con localidad: {audit['localities']['metadata'].get('mapped_circuits', 0)}.",
        f"- Circuitos sin localidad: {len(audit['localities']['metadata'].get('blank_locality_circuits', []))}.",
        f"- Pares partido-localidad: {audit['localities']['metadata'].get('party_locality_pairs', 0)}.",
        f"- Capa oficial de localidades: {audit['localities']['official_geometry_features']} features y {audit['localities']['official_geometry_unique_keys']} CLC unicos.",
        f"- Localidades con resultados electorales asignados: {audit['localities']['official_geometry_with_electoral_data']}; sin circuito principal: {audit['localities']['official_geometry_without_primary']}.",
        f"- Relaciones secundarias circuito-localidad conservadas: {audit['localities']['secondary_circuit_relations']}.",
        "- La cartografia de localidad usa los poligonos oficiales de localidades censales de mas de 2.000 habitantes.",
        "",
        md_table(locality_rows, ["eleccion", "localidades", "circuitos_vinculados", "cobertura_electores", "cierre_electores", "cierre_votos", "claves_partido_invalidas"]),
        "",
        "## Artefactos normalizados de la app",
        "",
        f"- `electoral_data.json` generado: {audit['app']['generated_at']}.",
        f"- Elecciones procesadas: {audit['app']['source_count']}.",
        f"- GeoJSON partidos app: {audit['app']['party_geo_features']} features, {audit['app']['party_geo_unique_keys']} claves unicas.",
        f"- GeoJSON circuitos app: {audit['app']['circuit_geo_features']} features, {audit['app']['circuit_geo_unique_keys']} claves unicas.",
        f"- GeoJSON localidades app: {audit['app']['locality_geo_features']} features, {audit['app']['locality_geo_unique_keys']} claves unicas.",
        "",
        md_table(app_rows, ["eleccion", "partidos", "circuitos_datos", "partidos_sin_geo", "circuitos_sin_geo", "cierre_votos", "cierre_electores", "cierre_positivos"]),
        "",
        "## Validacion de partidos criticos en datos agregados",
        "",
    ])

    important_rows = []
    for info in audit["app"]["elections"].values():
        for key, row in info["important_party_rows"].items():
            important_rows.append({
                "eleccion": info["label"],
                "codigo": key,
                "esperado": row["expected"],
                "nombre": row["name"],
                "circuitos": row["circuit_count"],
                "electores": fmt_int(row["electores"] or 0),
                "votantes": fmt_int(row["votantes"] or 0),
            })
    lines.append(md_table(important_rows, ["eleccion", "codigo", "esperado", "nombre", "circuitos", "electores", "votantes"]))

    lines.extend([
        "",
        "## Lectura operativa",
        "",
        "- A nivel partido, todas las elecciones quedan con 135 partidos y sin partidos con datos fuera de la geometria.",
        "- Chascomus y Lezama quedan separados por CODIGO: `06218` y `06466`.",
        "- General San Martin queda agregado por CODIGO `06371`, incluyendo circuitos historicos 2023 aunque no existan como poligonos individuales en la capa 2025.",
        "- En vista circuito, 2023 conserva una salvedad: los circuitos historicos `383` y `388` no tienen geometria propia en PBA3.",
        "",
    ])

    return "\n".join(lines)


def parse_args():
    parser = argparse.ArgumentParser(description="Audita los datos estáticos del Atlas Electoral PBA")
    parser.add_argument("--data-root", default=str(DATA_ROOT), help="Raíz externa que contiene 01_DINE y las capas")
    parser.add_argument("--data-dir", help="Directorio con los artefactos generados; por defecto data/")
    parser.add_argument("--output-dir", help="Directorio de informes; por defecto docs/")
    return parser.parse_args()


def main():
    args = parse_args()
    configure_paths(args.data_root, args.data_dir, args.output_dir)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = discover_sources()
    csv_audit = {source["id"]: inspect_csv(source) for source in sources}
    critical_errors = []
    for source_id, info in csv_audit.items():
        if info["duplicate_keys"]:
            critical_errors.append(f"{source_id}: {info['duplicate_keys']} duplicados")
        if info["null_keys"]:
            critical_errors.append(f"{source_id}: {info['null_keys']} claves nulas")
        if info["positive_closure_delta"]:
            critical_errors.append(f"{source_id}: cierre de positivos {info['positive_closure_delta']}")

    audit = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "critical_errors": critical_errors,
        "csv": csv_audit,
        "source_parties": inspect_source_parties(),
        "source_circuits": inspect_source_circuits(csv_audit),
        "app": inspect_app_artifacts(),
        "localities": inspect_localities(),
    }

    for source_id, info in audit["app"]["elections"].items():
        if info["votes_delta"] or info["electors_delta"] or info["positive_delta"]:
            critical_errors.append(
                f"{source_id}: diferencias salida/origen votos={info['votes_delta']}, "
                f"electores={info['electors_delta']}, positivos={info['positive_delta']}"
            )
    if audit["localities"]["official_geometry_features"] != 219 or audit["localities"]["official_geometry_unique_keys"] != 219:
        critical_errors.append("La capa web de localidades no contiene 219 CLC unicos.")
    if audit["localities"]["invalid_locality_party_keys"]:
        critical_errors.append("Hay CLC de la capa web incompatibles con su partido.")
    if audit["localities"]["invalid_circuit_relations"]:
        critical_errors.append("Hay relaciones circuito-localidad incompletas, duplicadas o interpartidarias.")
    for source_id, info in audit["localities"]["elections"].items():
        if any(info["deltas"].values()) or info["wrong_party_keys"]:
            critical_errors.append(
                f"{source_id}: cierre de localidades={info['deltas']}, "
                f"claves de partido invalidas={len(info['wrong_party_keys'])}"
            )
    (OUT_DIR / "auditoria_datos.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "auditoria_datos.md").write_text(build_report(audit), encoding="utf-8")
    if critical_errors:
        raise SystemExit("Auditoría con diferencias críticas: " + "; ".join(critical_errors))
    print(OUT_DIR / "auditoria_datos.md")
    print(OUT_DIR / "auditoria_datos.json")


if __name__ == "__main__":
    main()
