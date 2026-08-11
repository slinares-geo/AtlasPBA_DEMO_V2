#!/usr/bin/env python3
"""Audita la correspondencia circuito-localidad contra polígonos censales oficiales.

La auditoría no modifica los datos de la app. Genera:
  - auditoria_circuito_localidad.json
  - auditoria_circuito_localidad.csv
  - auditoria_circuito_localidad_localidades.csv
  - auditoria_circuito_localidad.md

Requiere Shapely 2.x y un nomenclador Georef de localidades censales.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

try:
    from shapely import STRtree, make_valid
    from shapely.geometry import Point, shape
    from shapely.ops import unary_union
    from shapely.validation import explain_validity
except ImportError as exc:  # pragma: no cover - mensaje operativo de CLI
    raise SystemExit(
        "Falta Shapely 2.x. Instalarlo en un entorno temporal y agregarlo a PYTHONPATH."
    ) from exc

from xlsx_reader import iter_xlsx_rows


APP_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATA_ROOT = Path(r"G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos")
GEOREF_SOURCE_URL = "https://apis.datos.gob.ar/georef/api/v2.0/localidades-censales.json"
MEANINGFUL_OVERLAP = 0.001  # 0,1 % del área de la localidad censal


def norm_text(value):
    return str(value or "").strip()


def canonical(value):
    text = unicodedata.normalize("NFD", norm_text(value).upper().replace("Ñ", "N"))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    aliases = {
        "9 DE JULIO": "NUEVE DE JULIO",
        "25 DE MAYO": "VEINTICINCO DE MAYO",
        "SAN NICOLAS": "SAN NICOLAS DE LOS ARROYOS",
    }
    return aliases.get(text, text)


def norm_circuit(value):
    text = norm_text(value).upper()
    match = re.fullmatch(r"0*(\d+)([A-Z]*)", text)
    return f"{int(match.group(1))}{match.group(2)}" if match else text


def canonical_field(value):
    text = unicodedata.normalize("NFD", norm_text(value).lower())
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_xlsx_mapping(path):
    rows = iter_xlsx_rows(path)
    header = next(rows, None)
    if not header:
        raise ValueError(f"{path}: archivo sin filas")
    columns = {canonical_field(value): index for index, value in enumerate(header)}
    missing = {"circuito", "localidad"} - set(columns)
    if missing:
        raise ValueError(f"{path}: faltan columnas {sorted(missing)}")
    mapping = {}
    duplicates = []
    for row_number, row in enumerate(rows, start=2):
        if not any(value not in (None, "") for value in row):
            continue
        circuit = norm_circuit(row[columns["circuito"]] if columns["circuito"] < len(row) else None)
        locality = norm_text(row[columns["localidad"]] if columns["localidad"] < len(row) else None)
        if circuit in mapping:
            duplicates.append(circuit)
        mapping[circuit] = {"locality": locality, "row": row_number}
    return mapping, duplicates


def geometry_record(feature):
    raw = shape(feature.get("geometry"))
    valid = raw.is_valid
    reason = None if valid else explain_validity(raw)
    fixed = raw if valid else make_valid(raw)
    return raw, fixed, valid, reason


def join_values(values):
    return " | ".join(str(value) for value in values if value not in (None, ""))


def pct(value):
    return round(value * 100, 4) if value is not None else None


def md_table(rows, columns):
    if not rows:
        return "_Sin casos._"
    header = "| " + " | ".join(columns) + " |"
    divider = "| " + " | ".join("---" for _ in columns) + " |"
    body = []
    for row in rows:
        body.append("| " + " | ".join(str(row.get(column, "")).replace("|", "\\|") for column in columns) + " |")
    return "\n".join([header, divider, *body])


def match_label(label, party_code, official_records, exact_index):
    key = canonical(label)
    exact = exact_index.get(key, [])
    same_party = [record for record in exact if record["party_code"] == party_code]
    if len(same_party) == 1:
        return [same_party[0]], "exact_same_party"
    if exact:
        return exact, "exact_other_or_multiple_party"

    same_party_pool = [record for record in official_records if record["party_code"] == party_code]
    scored_same = sorted(
        ((SequenceMatcher(None, key, record["canonical_name"]).ratio(), record) for record in same_party_pool),
        key=lambda item: item[0],
        reverse=True,
    )
    if scored_same:
        best_score, best = scored_same[0]
        second_score = scored_same[1][0] if len(scored_same) > 1 else 0
        if best_score >= 0.86 and best_score - second_score >= 0.08:
            return [best], f"fuzzy_same_party:{best_score:.3f}"

    scored_all = sorted(
        ((SequenceMatcher(None, key, record["canonical_name"]).ratio(), record) for record in official_records),
        key=lambda item: item[0],
        reverse=True,
    )
    if scored_all:
        best_score, best = scored_all[0]
        second_score = scored_all[1][0] if len(scored_all) > 1 else 0
        if best_score >= 0.90 and best_score - second_score >= 0.08:
            return [best], f"fuzzy_global:{best_score:.3f}"
    return [], "unresolved"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", default=str(DEFAULT_DATA_ROOT))
    parser.add_argument("--circuit-geojson", default=str(APP_DIR / "data" / "circuitos_pba.geojson"))
    parser.add_argument("--locality-geojson", help="GeoJSON de localidades censales de más de 2.000 habitantes")
    parser.add_argument("--locality-xlsx", help="Correspondencia vigente circuito-localidad")
    parser.add_argument("--nomenclator", required=True, help="JSON completo de localidades censales de Georef")
    parser.add_argument("--output-dir", default=str(APP_DIR / "docs"))
    return parser.parse_args()


def main():
    args = parse_args()
    data_root = Path(args.data_root)
    circuit_path = Path(args.circuit_geojson)
    locality_path = Path(args.locality_geojson) if args.locality_geojson else data_root / "03_circuitoselectoralespba" / "03_LocalidadesPBA_MAS2000.geojson"
    xlsx_path = Path(args.locality_xlsx) if args.locality_xlsx else data_root / "04_Socioeconomicos" / "Circuitos_con_localidades_mas_2000.xlsx"
    nomenclator_path = Path(args.nomenclator)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    circuit_geo = load_json(circuit_path)
    locality_geo = load_json(locality_path)
    nomenclator_json = load_json(nomenclator_path)
    nomenclator = {
        str(item["id"]): item
        for item in nomenclator_json.get("localidades_censales", [])
        if item.get("provincia", {}).get("id") == "06"
    }
    xlsx_mapping, xlsx_duplicates = load_xlsx_mapping(xlsx_path)

    circuits = []
    circuit_keys = set()
    circuit_duplicates = []
    invalid_circuits = []
    for feature in circuit_geo.get("features", []):
        props = feature.get("properties", {}) or {}
        key = norm_circuit(props.get("circuito") or props.get("key"))
        if key in circuit_keys:
            circuit_duplicates.append(key)
        circuit_keys.add(key)
        raw, geom, valid, reason = geometry_record(feature)
        if not valid:
            invalid_circuits.append({"circuit": key, "reason": reason})
        xlsx_row = xlsx_mapping.get(key, {})
        app_locality = norm_text(props.get("localidad"))
        xlsx_locality = norm_text(xlsx_row.get("locality"))
        circuits.append({
            "key": key,
            "party_code": norm_text(props.get("partido_norm") or props.get("cde")),
            "party_name": norm_text(props.get("partido")),
            "app_locality_key": norm_text(props.get("localidad_key")),
            "app_locality": app_locality,
            "xlsx_locality": xlsx_locality,
            "xlsx_row": xlsx_row.get("row"),
            "mapping_consistent": app_locality == xlsx_locality,
            "raw_geometry": raw,
            "geometry": geom,
            "geometry_valid": valid,
            "geometry_reason": reason,
        })

    official = []
    invalid_localities = []
    missing_nomenclator = []
    for feature in locality_geo.get("features", []):
        props = feature.get("properties", {}) or {}
        clc = str(props.get("clc") or "")
        name_info = nomenclator.get(clc)
        if not name_info:
            missing_nomenclator.append(clc)
        raw, geom, valid, reason = geometry_record(feature)
        if not valid:
            invalid_localities.append({"clc": clc, "reason": reason})
        official_name = norm_text(name_info.get("nombre") if name_info else props.get("nam"))
        official.append({
            "clc": clc,
            "party_code": norm_text(props.get("cde") or (name_info or {}).get("departamento", {}).get("id")),
            "party_name": norm_text((name_info or {}).get("departamento", {}).get("nombre") or props.get("dpto")),
            "official_name": official_name,
            "raw_name": norm_text(props.get("nam")),
            "category": norm_text((name_info or {}).get("categoria")),
            "canonical_name": canonical(official_name),
            "centroid": (name_info or {}).get("centroide"),
            "raw_geometry": raw,
            "geometry": geom,
            "geometry_valid": valid,
            "geometry_reason": reason,
            "area": geom.area,
            "overlaps": [],
        })

    circuit_geometries = [record["geometry"] for record in circuits]
    circuit_tree = STRtree(circuit_geometries)
    circuit_index_by_key = {record["key"]: index for index, record in enumerate(circuits)}

    # Intersecciones exactas localidad -> circuito. El cociente usa área planar CRS84;
    # es adecuado para proporciones locales, no se reporta como superficie física.
    for locality in official:
        geom = locality["geometry"]
        area = locality["area"]
        if not area:
            continue
        for index in circuit_tree.query(geom):
            circuit = circuits[int(index)]
            intersection = geom.intersection(circuit["geometry"])
            if intersection.is_empty or intersection.area <= 0:
                continue
            ratio = intersection.area / area
            centroid_inside = False
            if locality.get("centroid"):
                point = Point(locality["centroid"]["lon"], locality["centroid"]["lat"])
                centroid_inside = circuit["geometry"].covers(point)
            locality["overlaps"].append({
                "circuit": circuit["key"],
                "party_code": circuit["party_code"],
                "ratio_locality_area": ratio,
                "meaningful": ratio >= MEANINGFUL_OVERLAP or centroid_inside,
                "centroid_inside": centroid_inside,
            })

    official_by_clc = {record["clc"]: record for record in official}
    exact_index = defaultdict(list)
    for record in official:
        exact_index[record["canonical_name"]].append(record)

    spatial_by_circuit = defaultdict(list)
    for locality in official:
        for overlap in locality["overlaps"]:
            if overlap["meaningful"] and overlap["party_code"] == locality["party_code"]:
                spatial_by_circuit[overlap["circuit"]].append({
                    "clc": locality["clc"],
                    "name": locality["official_name"],
                    "party_code": locality["party_code"],
                    "ratio": overlap["ratio_locality_area"],
                    "centroid_inside": overlap["centroid_inside"],
                })

    audit_rows = []
    for circuit in circuits:
        label = circuit["xlsx_locality"]
        spatial_candidates = sorted(spatial_by_circuit.get(circuit["key"], []), key=lambda item: item["ratio"], reverse=True)
        matched, match_method = match_label(label, circuit["party_code"], official, exact_index) if label else ([], "blank")
        same_party_matches = [item for item in matched if item["party_code"] == circuit["party_code"]]
        matched_overlaps = []
        for item in matched:
            for overlap in item["overlaps"]:
                if overlap["circuit"] == circuit["key"] and overlap["meaningful"]:
                    matched_overlaps.append((item, overlap))

        if not label:
            status = "blank_with_official_overlap" if spatial_candidates else "blank_without_official_overlap"
        elif same_party_matches and any(item["party_code"] == circuit["party_code"] for item, _ in matched_overlaps):
            status = "valid_same_party_spatial"
        elif same_party_matches:
            status = "same_party_label_without_spatial_overlap"
        elif matched:
            status = "label_matches_other_party"
        elif spatial_candidates:
            status = "unresolved_label_with_official_overlap"
        else:
            status = "unresolved_label_without_official_overlap"

        best_overlap = max((overlap["ratio_locality_area"] for _, overlap in matched_overlaps), default=None)
        audit_rows.append({
            "circuit": circuit["key"],
            "party_code": circuit["party_code"],
            "party_name": circuit["party_name"],
            "xlsx_row": circuit["xlsx_row"],
            "assigned_locality": label,
            "app_locality_key": circuit["app_locality_key"],
            "mapping_consistent": circuit["mapping_consistent"],
            "status": status,
            "match_method": match_method,
            "matched_clc": [item["clc"] for item in matched],
            "matched_official_names": [item["official_name"] for item in matched],
            "matched_party_codes": sorted({item["party_code"] for item in matched}),
            "matched_party_names": sorted({item["party_name"] for item in matched}),
            "assigned_overlap_pct": pct(best_overlap),
            "spatial_candidate_clc": [item["clc"] for item in spatial_candidates],
            "spatial_candidate_names": [item["name"] for item in spatial_candidates],
            "spatial_candidate_overlap_pct": [pct(item["ratio"]) for item in spatial_candidates],
            "geometry_valid": circuit["geometry_valid"],
            "geometry_reason": circuit["geometry_reason"],
        })

    locality_rows = []
    assigned_by_circuit = {row["circuit"]: row for row in audit_rows}
    for locality in official:
        meaningful = [item for item in locality["overlaps"] if item["meaningful"]]
        same_party = [item for item in meaningful if item["party_code"] == locality["party_code"]]
        other_party = [item for item in meaningful if item["party_code"] != locality["party_code"]]
        same_union = unary_union([
            locality["geometry"].intersection(circuits[circuit_index_by_key[item["circuit"]]]["geometry"])
            for item in same_party
        ]) if same_party else None
        coverage = same_union.area / locality["area"] if same_union and locality["area"] else 0
        matching_assigned = []
        observed_labels = []
        for item in same_party:
            row = assigned_by_circuit[item["circuit"]]
            if row["assigned_locality"]:
                observed_labels.append(row["assigned_locality"])
            if locality["clc"] in row["matched_clc"]:
                matching_assigned.append(item["circuit"])
        if not same_party:
            status = "no_same_party_circuit_overlap"
        elif matching_assigned:
            status = "represented_in_assignment"
        else:
            status = "official_locality_not_represented"
        locality_rows.append({
            "clc": locality["clc"],
            "party_code": locality["party_code"],
            "party_name": locality["party_name"],
            "official_name": locality["official_name"],
            "raw_name": locality["raw_name"],
            "category": locality["category"],
            "status": status,
            "geometry_valid": locality["geometry_valid"],
            "geometry_reason": locality["geometry_reason"],
            "same_party_circuits": [item["circuit"] for item in same_party],
            "same_party_coverage_pct": pct(coverage),
            "other_party_circuits": [item["circuit"] for item in other_party],
            "matching_assigned_circuits": matching_assigned,
            "observed_labels": sorted(set(observed_labels)),
        })

    status_counts = Counter(row["status"] for row in audit_rows)
    assigned_rows = [row for row in audit_rows if row["assigned_locality"]]
    blank_rows = [row for row in audit_rows if not row["assigned_locality"]]
    locality_status_counts = Counter(row["status"] for row in locality_rows)
    problem_rows = [row for row in audit_rows if row["status"] not in {"valid_same_party_spatial", "blank_without_official_overlap"}]
    problem_parties = Counter(row["party_name"] for row in problem_rows)
    cross_party_groups = Counter(
        (row["party_code"], row["party_name"], row["assigned_locality"], join_values(row["matched_party_names"]))
        for row in audit_rows if row["status"] == "label_matches_other_party"
    )

    summary = {
        "circuits": len(circuits),
        "assigned_circuits": len(assigned_rows),
        "blank_circuits": len(blank_rows),
        "official_localities": len(official),
        "status_counts": dict(sorted(status_counts.items())),
        "locality_status_counts": dict(sorted(locality_status_counts.items())),
        "invalid_circuit_geometries": len(invalid_circuits),
        "invalid_locality_geometries": len(invalid_localities),
        "missing_nomenclator_codes": len(missing_nomenclator),
        "xlsx_duplicate_circuits": len(xlsx_duplicates),
        "circuit_duplicate_geometries": len(circuit_duplicates),
        "mapping_differences_xlsx_vs_app": sum(not row["mapping_consistent"] for row in audit_rows),
    }

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "sources": {
            "circuit_geojson": str(circuit_path),
            "locality_geojson": str(locality_path),
            "locality_xlsx": str(xlsx_path),
            "georef_nomenclator_file": str(nomenclator_path),
            "georef_source_url": GEOREF_SOURCE_URL,
        },
        "methodology": {
            "geometry_engine": "Shapely",
            "intersection": "exact polygon intersection after make_valid for invalid inputs",
            "area_note": "Ratios use planar area in CRS84; suitable for local proportions, not physical area.",
            "meaningful_overlap_threshold": MEANINGFUL_OVERLAP,
            "name_matching": "official CLC names from Georef; exact normalized match, then conservative fuzzy fallback",
        },
        "summary": summary,
        "quality": {
            "invalid_circuit_geometries": invalid_circuits,
            "invalid_locality_geometries": invalid_localities,
            "missing_nomenclator_codes": missing_nomenclator,
            "xlsx_duplicate_circuits": xlsx_duplicates,
            "circuit_duplicate_geometries": circuit_duplicates,
        },
        "circuits": audit_rows,
        "official_localities": locality_rows,
    }

    json_path = output_dir / "auditoria_circuito_localidad.json"
    csv_path = output_dir / "auditoria_circuito_localidad.csv"
    locality_csv_path = output_dir / "auditoria_circuito_localidad_localidades.csv"
    md_path = output_dir / "auditoria_circuito_localidad.md"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    circuit_columns = [
        "circuit", "party_code", "party_name", "xlsx_row", "assigned_locality", "app_locality_key",
        "status", "match_method", "matched_clc", "matched_official_names", "matched_party_codes",
        "matched_party_names", "assigned_overlap_pct", "spatial_candidate_clc", "spatial_candidate_names",
        "spatial_candidate_overlap_pct", "mapping_consistent", "geometry_valid", "geometry_reason",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=circuit_columns)
        writer.writeheader()
        for row in audit_rows:
            writer.writerow({column: join_values(row[column]) if isinstance(row[column], list) else row[column] for column in circuit_columns})

    locality_columns = [
        "clc", "party_code", "party_name", "official_name", "raw_name", "category", "status",
        "same_party_circuits", "same_party_coverage_pct", "other_party_circuits",
        "matching_assigned_circuits", "observed_labels", "geometry_valid", "geometry_reason",
    ]
    with locality_csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=locality_columns)
        writer.writeheader()
        for row in locality_rows:
            writer.writerow({column: join_values(row[column]) if isinstance(row[column], list) else row[column] for column in locality_columns})

    pilar_rows = [row for row in audit_rows if row["party_code"] == "06638"]
    pilar_table = [{
        "circuito": row["circuit"],
        "localidad Excel": row["assigned_locality"] or "(vacía)",
        "estado": row["status"],
        "localidad oficial intersectada": join_values(row["spatial_candidate_names"]) or "—",
    } for row in pilar_rows]

    cross_party_table = [{
        "partido circuito": party_name,
        "etiqueta Excel": label,
        "partido oficial de la etiqueta": official_party,
        "circuitos": count,
    } for (party_code, party_name, label, official_party), count in cross_party_groups.most_common()]

    problem_party_table = [{"partido": party, "circuitos observados": count} for party, count in problem_parties.most_common(20)]
    status_table = [{"estado": status, "circuitos": count} for status, count in sorted(status_counts.items())]
    locality_status_table = [{"estado": status, "localidades": count} for status, count in sorted(locality_status_counts.items())]

    lines = [
        "# Auditoría circuito–localidad contra localidades censales oficiales",
        "",
        f"Generado: {payload['generated_at']}",
        "",
        "## Objetivo",
        "",
        "Evaluar si la etiqueta de localidad asignada a cada circuito electoral es nominal y espacialmente compatible con la capa de localidades censales bonaerenses de más de 2.000 habitantes.",
        "Esta auditoría es independiente de la relación radio censal–circuito y no modifica la agregación vigente de la app.",
        "",
        "## Método",
        "",
        "- Los nombres oficiales se recuperan por el código CLC de ocho dígitos mediante el nomenclador Georef.",
        "- Las geometrías inválidas se informan y se reparan solo en memoria con `make_valid` para calcular intersecciones.",
        "- Se calcula la intersección poligonal exacta entre cada localidad y cada circuito candidato.",
        "- Una intersección se considera significativa cuando cubre al menos 0,1 % del área de la localidad o contiene su centroide oficial.",
        "- Los porcentajes de área son proporciones planares en CRS84 y no representan km².",
        "",
        "## Resumen",
        "",
        f"- Circuitos auditados: **{summary['circuits']}**.",
        f"- Circuitos con localidad asignada: **{summary['assigned_circuits']}**.",
        f"- Circuitos con localidad vacía: **{summary['blank_circuits']}**.",
        f"- Localidades oficiales auditadas: **{summary['official_localities']}**.",
        f"- Diferencias entre el XLSX y el GeoJSON actual de la app: **{summary['mapping_differences_xlsx_vs_app']}**.",
        f"- Códigos CLC sin nombre en Georef: **{summary['missing_nomenclator_codes']}**.",
        "",
        md_table(status_table, ["estado", "circuitos"]),
        "",
        "## Cobertura de las localidades oficiales",
        "",
        md_table(locality_status_table, ["estado", "localidades"]),
        "",
        "## Etiquetas que corresponden a otro partido",
        "",
        md_table(cross_party_table, ["partido circuito", "etiqueta Excel", "partido oficial de la etiqueta", "circuitos"]),
        "",
        "## Partidos con más observaciones",
        "",
        md_table(problem_party_table, ["partido", "circuitos observados"]),
        "",
        "## Caso Pilar",
        "",
        md_table(pilar_table, ["circuito", "localidad Excel", "estado", "localidad oficial intersectada"]),
        "",
        "## Calidad geométrica",
        "",
        f"- Geometrías de circuito inválidas de origen: **{summary['invalid_circuit_geometries']}**.",
        f"- Geometrías de localidad inválidas de origen: **{summary['invalid_locality_geometries']}**.",
        "- Las razones completas y los registros por circuito/localidad se encuentran en el JSON y los CSV asociados.",
        "",
        "## Archivos de detalle",
        "",
        "- `auditoria_circuito_localidad.csv`: una fila por circuito.",
        "- `auditoria_circuito_localidad_localidades.csv`: una fila por localidad oficial.",
        "- `auditoria_circuito_localidad.json`: evidencia completa, fuentes, parámetros y geometrías observadas.",
    ]
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({"outputs": [str(json_path), str(csv_path), str(locality_csv_path), str(md_path)], "summary": summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
