#!/usr/bin/env python3
"""Deriva una localidad urbana principal por circuito desde radios censales.

La fuente radio-localidad usa CLC nulo para radios fuera del universo de
localidades censales de más de 2.000 habitantes. Cuando un circuito contiene
radios de varias localidades, la principal se define por población 2022.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import struct
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

from xlsx_reader import iter_xlsx_rows


APP_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATA_ROOT = Path(r"G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos")
DEFAULT_NOMENCLATOR = APP_DIR / "data" / "localidades_pba_mas2000.json"
DEFAULT_CIRCUITS = APP_DIR / "data" / "circuitos_pba.geojson"
DEFAULT_OUTPUT_DIR = APP_DIR / "docs"

RADIO_LOCALITY_FILE = "Radios_con_Localidades.dbf"
RADIO_CIRCUIT_FILE = "Circuitos_Radios_uno_a_muchos.xlsx"
POPULATION_FILE = Path("Full") / "MDO_socioeconómica_radios_Provincia_Bs_As (c).xlsx"
POPULATION_RADIO_COLUMN = 1
POPULATION_TOTAL_COLUMN = 38
HIGH_CONFIDENCE_SHARE = 0.70
MEDIUM_CONFIDENCE_SHARE = 0.55


def norm_text(value):
    return str(value or "").strip()


def norm_radio(value):
    text = norm_text(value)
    if not text:
        return ""
    try:
        number = Decimal(text)
    except InvalidOperation:
        return ""
    if number != number.to_integral_value():
        return ""
    return str(int(number)).zfill(9)


def norm_circuit(value):
    text = norm_text(value).upper()
    match = re.fullmatch(r"0*(\d+)(.*)", text)
    return f"{int(match.group(1))}{match.group(2)}" if match else text.lstrip("0") or text


def load_radio_circuit(path):
    rows = iter_xlsx_rows(path)
    header = next(rows, None)
    columns = {norm_text(value).casefold(): index for index, value in enumerate(header or [])}
    if not {"recode", "circuito"}.issubset(columns):
        raise ValueError(f"{path.name}: se requieren RECODE y circuito")
    mapping = {}
    for row in rows:
        radio = norm_radio(row[columns["recode"]] if columns["recode"] < len(row) else None)
        circuit = norm_circuit(row[columns["circuito"]] if columns["circuito"] < len(row) else None)
        if not radio or not circuit:
            raise ValueError(f"{path.name}: clave radio-circuito vacía")
        if radio in mapping:
            raise ValueError(f"{path.name}: radio duplicado {radio}")
        mapping[radio] = circuit
    return mapping


def _decode_dbf(raw):
    raw = raw.rstrip(b" \0")
    if not raw:
        return ""
    try:
        return raw.decode("utf-8").strip()
    except UnicodeDecodeError:
        return raw.decode("cp1252", "replace").strip()


def load_radio_localities(path):
    """Lee el DBF sin dependencias externas y devuelve radio -> CLC/nombre."""
    mapping = {}
    deleted = 0
    with path.open("rb") as handle:
        header = handle.read(32)
        record_count = struct.unpack_from("<I", header, 4)[0]
        header_length = struct.unpack_from("<H", header, 8)[0]
        record_length = struct.unpack_from("<H", header, 10)[0]
        fields = []
        while True:
            descriptor = handle.read(32)
            if descriptor[0] == 0x0D:
                break
            fields.append((descriptor[:11].split(b"\0", 1)[0].decode("ascii"), descriptor[16]))
        required = {"RECODE", "clc", "nam"}
        if not required.issubset(name for name, _ in fields):
            raise ValueError(f"{path.name}: se requieren {', '.join(sorted(required))}")
        handle.seek(header_length)
        for _ in range(record_count):
            raw_record = handle.read(record_length)
            if not raw_record:
                break
            if raw_record[:1] == b"*":
                deleted += 1
                continue
            offset = 1
            values = {}
            for name, length in fields:
                values[name] = _decode_dbf(raw_record[offset:offset + length])
                offset += length
            radio = norm_radio(values.get("RECODE"))
            clc = norm_text(values.get("clc"))
            if not re.fullmatch(r"\d{9}", radio):
                raise ValueError(f"{path.name}: RECODE inválido {values.get('RECODE')!r}")
            if clc and not re.fullmatch(r"\d{8}", clc):
                raise ValueError(f"{path.name}: CLC inválido {clc!r} para {radio}")
            if radio in mapping:
                raise ValueError(f"{path.name}: radio duplicado {radio}")
            mapping[radio] = {"clc": clc or None, "raw_name": norm_text(values.get("nam")) or None}
    return mapping, {
        "records": len(mapping),
        "deleted_records": deleted,
        "with_clc": sum(1 for row in mapping.values() if row["clc"]),
        "without_clc": sum(1 for row in mapping.values() if not row["clc"]),
        "unique_clc": len({row["clc"] for row in mapping.values() if row["clc"]}),
    }


def load_population(path):
    output = {}
    for row in iter_xlsx_rows(path):
        radio = norm_radio(row[POPULATION_RADIO_COLUMN] if POPULATION_RADIO_COLUMN < len(row) else None)
        if not radio:
            continue
        if radio in output:
            raise ValueError(f"{path.name}: radio duplicado {radio}")
        value = row[POPULATION_TOTAL_COLUMN] if POPULATION_TOTAL_COLUMN < len(row) else None
        try:
            population = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"{path.name}: Totaledad inválido para {radio}: {value!r}")
        output[radio] = int(population) if population.is_integer() else population
    return output


def load_nomenclator(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    records = data.get("localities", data if isinstance(data, list) else [])
    output = {}
    for row in records:
        clc = norm_text(row.get("clc"))
        if not re.fullmatch(r"\d{8}", clc):
            raise ValueError(f"{path.name}: CLC inválido {clc!r}")
        if clc in output:
            raise ValueError(f"{path.name}: CLC duplicado {clc}")
        output[clc] = {
            "clc": clc,
            "name": norm_text(row.get("name") or row.get("official_name")),
            "party_code": norm_text(row.get("party_code") or clc[:5]),
            "party_name": norm_text(row.get("party_name")),
        }
    return output, data.get("source") if isinstance(data, dict) else None


def confidence_for_share(share):
    if share >= HIGH_CONFIDENCE_SHARE:
        return "alta"
    if share >= MEDIUM_CONFIDENCE_SHARE:
        return "media"
    return "revision"


def derive_assignments(data_root, circuit_parties, nomenclator_path=DEFAULT_NOMENCLATOR):
    socio_dir = Path(data_root) / "04_Socioeconomicos"
    radio_circuit = load_radio_circuit(socio_dir / RADIO_CIRCUIT_FILE)
    radio_locality, dbf_meta = load_radio_localities(socio_dir / RADIO_LOCALITY_FILE)
    population = load_population(socio_dir / POPULATION_FILE)
    nomenclator, nomenclator_source = load_nomenclator(Path(nomenclator_path))

    key_sets = {"radio_circuit": set(radio_circuit), "radio_locality": set(radio_locality), "population": set(population)}
    reference = key_sets["radio_circuit"]
    if any(keys != reference for keys in key_sets.values()):
        details = {name: {"missing": len(reference - keys), "extra": len(keys - reference)} for name, keys in key_sets.items()}
        raise ValueError(f"No cierra el universo de radios: {details}")
    observed_clc = {row["clc"] for row in radio_locality.values() if row["clc"]}
    if observed_clc != set(nomenclator):
        raise ValueError(
            f"No cierra el nomenclador CLC: sin_nombre={sorted(observed_clc - set(nomenclator))}, "
            f"sin_radios={sorted(set(nomenclator) - observed_clc)}"
        )

    buckets = defaultdict(lambda: {
        "radio_count": 0,
        "null_radio_count": 0,
        "null_population": 0,
        "candidates": defaultdict(lambda: {"radio_count": 0, "population": 0}),
        "excluded_cross_party": [],
    })
    radio_circuit_cross_party = []
    radio_locality_cross_party = []
    for radio, circuit in radio_circuit.items():
        if circuit not in circuit_parties:
            raise ValueError(f"Circuito sin partido/geometría: {circuit}")
        party_code = circuit_parties[circuit]["key"]
        locality = radio_locality[radio]
        clc = locality["clc"]
        bucket = buckets[circuit]
        bucket["radio_count"] += 1
        if radio[:5] != party_code:
            item = {"radio": radio, "circuit": circuit, "radio_party": radio[:5], "circuit_party": party_code, "clc": clc}
            radio_circuit_cross_party.append(item)
            bucket["excluded_cross_party"].append(item)
        if not clc:
            bucket["null_radio_count"] += 1
            bucket["null_population"] += population[radio]
            continue
        if clc[:5] != radio[:5]:
            radio_locality_cross_party.append({"radio": radio, "radio_party": radio[:5], "clc": clc, "clc_party": clc[:5]})
        if clc[:5] != party_code:
            continue
        candidate = bucket["candidates"][clc]
        candidate["radio_count"] += 1
        candidate["population"] += population[radio]

    if radio_locality_cross_party:
        raise ValueError(f"Hay relaciones radio-CLC interpartidarias: {radio_locality_cross_party[:10]}")

    assignments = {}
    circuit_rows = []
    status_counts = Counter()
    confidence_counts = Counter()
    for circuit, party in circuit_parties.items():
        bucket = buckets.get(circuit)
        if not bucket:
            status = "sin_radios"
            method = None
            confidence = None
            primary = None
            candidates = []
            radio_count = null_radio_count = null_population = urban_population = 0
            excluded = []
        else:
            radio_count = bucket["radio_count"]
            null_radio_count = bucket["null_radio_count"]
            null_population = bucket["null_population"]
            excluded = bucket["excluded_cross_party"]
            urban_population = sum(item["population"] for item in bucket["candidates"].values())
            candidates = []
            for clc, values in bucket["candidates"].items():
                candidates.append({
                    "clc": clc,
                    "name": nomenclator[clc]["name"],
                    "party_code": nomenclator[clc]["party_code"],
                    "radio_count": values["radio_count"],
                    "population": values["population"],
                    "population_share": values["population"] / urban_population if urban_population else None,
                })
            candidates.sort(key=lambda item: (-item["population"], -item["radio_count"], item["clc"]))
            if not candidates:
                status = "sin_localidad_mas2000"
                method = None
                confidence = None
                primary = None
            elif len(candidates) == 1:
                status = "localidad_unica"
                method = "radios_clc_unico"
                confidence = "alta"
                primary = candidates[0]
            else:
                primary = candidates[0]
                confidence = confidence_for_share(primary["population_share"])
                status = "multilocalidad_clasificada" if confidence != "revision" else "multilocalidad_revision"
                method = "mayor_poblacion_radios"
        status_counts[status] += 1
        if confidence:
            confidence_counts[confidence] += 1
        row = {
            "circuit": circuit,
            "party_code": party["key"],
            "party_name": party["name"],
            "status": status,
            "method": method,
            "confidence": confidence,
            "assigned_clc": primary["clc"] if primary else None,
            "assigned_name": primary["name"] if primary else None,
            "dominant_population_share": primary["population_share"] if primary else None,
            "radio_count": radio_count,
            "urban_radio_count": sum(item["radio_count"] for item in candidates),
            "null_radio_count": null_radio_count,
            "urban_population": urban_population,
            "null_population": null_population,
            "candidate_count": len(candidates),
            "candidates": candidates,
            "excluded_cross_party_radios": excluded,
        }
        assignments[circuit] = row
        circuit_rows.append(row)

    primary_clc = {row["assigned_clc"] for row in circuit_rows if row["assigned_clc"]}
    report = {
        "methodology": {
            "universe": "Localidades censales de más de 2.000 habitantes; CLC nulo queda sin localidad urbana.",
            "unique": "Un único CLC entre los radios del circuito.",
            "multilocality": "CLC con mayor población 2022 sumada desde sus radios.",
            "confidence": {"alta": f">={HIGH_CONFIDENCE_SHARE:.0%}", "media": f">={MEDIUM_CONFIDENCE_SHARE:.0%} y <{HIGH_CONFIDENCE_SHARE:.0%}", "revision": f"<{MEDIUM_CONFIDENCE_SHARE:.0%}"},
            "cross_party": "Los radios cuyo partido no coincide con el circuito se informan y se excluyen de la elección de CLC.",
        },
        "summary": {
            "circuits": len(circuit_parties),
            "radios": len(radio_circuit),
            "radios_with_clc": dbf_meta["with_clc"],
            "radios_without_clc": dbf_meta["without_clc"],
            "official_localities": len(nomenclator),
            "primary_localities": len(primary_clc),
            "official_localities_without_primary_circuit": len(set(nomenclator) - primary_clc),
            "status_counts": dict(sorted(status_counts.items())),
            "confidence_counts": dict(sorted(confidence_counts.items())),
            "radio_circuit_cross_party": len(radio_circuit_cross_party),
            "radio_locality_cross_party": len(radio_locality_cross_party),
        },
        "sources": {
            "radio_locality": str(socio_dir / RADIO_LOCALITY_FILE),
            "radio_circuit": str(socio_dir / RADIO_CIRCUIT_FILE),
            "population": str(socio_dir / POPULATION_FILE),
            "nomenclator": str(Path(nomenclator_path)),
            "nomenclator_source": nomenclator_source,
        },
        "radio_locality_source_audit": dbf_meta,
        "radio_circuit_cross_party": radio_circuit_cross_party,
        "official_localities_without_primary_circuit": [nomenclator[clc] for clc in sorted(set(nomenclator) - primary_clc)],
        "circuits": sorted(circuit_rows, key=lambda row: (len(row["circuit"]), row["circuit"])),
    }
    return assignments, report


def _fmt_pct(value):
    return "" if value is None else f"{value * 100:.2f}%"


def write_report(report, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "auditoria_radio_localidad.json"
    csv_path = output_dir / "auditoria_radio_localidad_circuitos.csv"
    md_path = output_dir / "auditoria_radio_localidad.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    columns = [
        "circuit", "party_code", "party_name", "status", "method", "confidence",
        "assigned_clc", "assigned_name", "dominant_population_share", "radio_count",
        "urban_radio_count", "null_radio_count", "urban_population", "null_population",
        "candidate_count", "candidate_clc", "candidate_names", "candidate_population",
        "candidate_shares", "excluded_cross_party_radios",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in report["circuits"]:
            candidates = row["candidates"]
            writer.writerow({
                **{key: row.get(key) for key in columns if key in row},
                "dominant_population_share": _fmt_pct(row["dominant_population_share"]),
                "candidate_clc": " | ".join(item["clc"] for item in candidates),
                "candidate_names": " | ".join(item["name"] for item in candidates),
                "candidate_population": " | ".join(str(item["population"]) for item in candidates),
                "candidate_shares": " | ".join(_fmt_pct(item["population_share"]) for item in candidates),
                "excluded_cross_party_radios": " | ".join(item["radio"] for item in row["excluded_cross_party_radios"]),
            })
    summary = report["summary"]
    multi = [row for row in report["circuits"] if row["candidate_count"] > 1]
    lines = [
        "# Auditoría radio–localidad–circuito", "",
        "## Resumen", "",
        f"- Radios auditados: **{summary['radios']}**.",
        f"- Radios con CLC >2.000 habitantes: **{summary['radios_with_clc']}**.",
        f"- Radios sin CLC urbano: **{summary['radios_without_clc']}**.",
        f"- Localidades oficiales: **{summary['official_localities']}**.",
        f"- Localidades elegidas como principal por algún circuito: **{summary['primary_localities']}**.",
        f"- Relaciones radio–circuito interpartidarias excluidas de la clasificación: **{summary['radio_circuit_cross_party']}**.",
        "", "## Clasificación de circuitos", "",
        "| Estado | Circuitos |", "| --- | ---: |",
    ]
    lines.extend(f"| {status} | {count} |" for status, count in summary["status_counts"].items())
    lines.extend(["", "## Circuitos multilocalidad", "", "| Circuito | Partido | Principal | Peso poblacional | Confianza | Alternativas |", "| --- | --- | --- | ---: | --- | --- |"])
    for row in multi:
        alternatives = "; ".join(f"{item['name']} ({_fmt_pct(item['population_share'])})" for item in row["candidates"][1:])
        lines.append(f"| {row['circuit']} | {row['party_name']} | {row['assigned_name']} | {_fmt_pct(row['dominant_population_share'])} | {row['confidence']} | {alternatives} |")
    lines.extend(["", "## Límites", "", "- La localidad principal permite asignar una sola vez los resultados electorales agregados del circuito.", "- Las localidades secundarias se conservan en el JSON y el CSV; no reciben una fracción de votos porque no existen resultados electorales por radio.", "- Los nombres de presentación provienen del nomenclador oficial; el campo `nam` del DBF no se utiliza como clave.", ""])
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return [json_path, csv_path, md_path]


def circuit_parties_from_geojson(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        norm_circuit(feature["properties"].get("key") or feature["properties"].get("circuito")): {
            "key": norm_text(feature["properties"].get("partido_norm") or feature["properties"].get("cde")),
            "name": norm_text(feature["properties"].get("partido")),
        }
        for feature in data.get("features", [])
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", default=str(DEFAULT_DATA_ROOT))
    parser.add_argument("--circuit-geojson", default=str(DEFAULT_CIRCUITS))
    parser.add_argument("--nomenclator", default=str(DEFAULT_NOMENCLATOR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()
    parties = circuit_parties_from_geojson(Path(args.circuit_geojson))
    _, report = derive_assignments(Path(args.data_root), parties, Path(args.nomenclator))
    outputs = write_report(report, Path(args.output_dir))
    print(json.dumps({"outputs": [str(path) for path in outputs], "summary": report["summary"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
