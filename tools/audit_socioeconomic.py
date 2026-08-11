import argparse
import json
import math
from collections import Counter
from datetime import datetime
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = APP_DIR / "data" / "socioeconomic_data.json"
DEFAULT_OUTPUT_DIR = APP_DIR / "docs"
EXPECTED_PROVISIONAL_CROSS_PARTY = {
    ("067600613", "668A"), ("067601310", "668A"),
    ("067601311", "668A"), ("067001004", "954"),
}
EXPECTED_CIRCUITS_WITHOUT_RADIOS = {"128", "313", "338B", "548"}
EXPECTED_CONSOLIDATED = {
    "party": ("partidos_socioeconomicos.json", 135),
    "locality": ("localidades_socioeconomicas.json", 219),
    "circuit": ("circuitos_socioeconomicos.json", 1153),
}
EXPECTED_FULL_SOURCES = {
    "MDO_socioeconómica_radios_Provincia_Bs_As (a).xlsx",
    "MDO_socioeconómica_radios_Provincia_Bs_As (b).xlsx",
    "MDO_socioeconómica_radios_Provincia_Bs_As (c).xlsx",
}
REQUIRED_VARIABLE_FIELDS = {
    "id", "nombre_corto", "descripcion", "fuente", "anio", "universo",
    "tipo", "unidad", "numerador", "metodo_agregacion", "decimales",
    "grupo_tematico", "agregable_en",
}
COMPLETE_DISTRIBUTIONS = {
    "population_age": ["EDAD0_14", "EDAD15_29", "EDAD30_54", "EDAD55yMas"],
    "migration": ["P17_1P", "p17_2P", "p17_3P", "p17_4P", "p17_5P"],
    "educational_climate": ["eduhog1P", "eduhog2P", "eduhog3P", "eduhog4P", "eduhog5P"],
    "digital_access": ["h24c_1P", "h24c_2P"],
    "nbi_housing": ["nbi_tot_1P", "nbi_tot_2P"],
    "health_coverage": ["p19_1P", "p19_2P", "p19_3P"],
    "pension": ["p20_1P", "p20_2P"],
    "activity": ["condac_1P", "condac_2P", "condac_3P"],
    "occupational_category": ["P30_1P", "p30_2P", "p30_3P", "p30_4P", "p30_5P", "p30_6P"],
    "activity_branch": list("ABCDEFGHIJKLMNOPQRSTU") + ["V", "Z"],
    "housing_type": [f"v01_1ocup_{index}P" for index in range(1, 9)],
    "overcrowding": [f"hacin_{index}P" for index in range(1, 7)],
    "material_quality": [f"inmat_{index}P" for index in range(1, 6)],
    "housing_tenure": [f"h22_{index}P" for index in range(1, 6)],
}


def fmt_int(value):
    return f"{value:,}".replace(",", ".")


def audit_consolidated(input_dir, variables, territories):
    relative_ids = {variable["id"] for variable in variables if variable.get("tipo") == "proporcion"}
    circuit_geo = json.loads((APP_DIR / "data" / "circuitos_pba.geojson").read_text(encoding="utf-8"))
    circuit_props = {feature["properties"]["key"]: feature["properties"] for feature in circuit_geo.get("features", [])}
    critical = []
    issues = []
    summary = {}

    for level, (filename, expected_count) in EXPECTED_CONSOLIDATED.items():
        path = input_dir / filename
        if not path.exists():
            critical.append(f"Falta el archivo consolidado {filename}.")
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        records = payload.get("territories", [])
        ids = [record.get("territorio_id") for record in records]
        duplicates = sorted(key for key, count in Counter(ids).items() if key and count > 1)
        if len(records) != expected_count:
            critical.append(f"{filename} debe contener {expected_count} territorios y contiene {len(records)}.")
        if len(set(ids)) != len(ids) or duplicates:
            critical.append(f"{filename} tiene identificadores territoriales duplicados.")
        if payload.get("metadata", {}).get("territory_count") != len(records):
            critical.append(f"{filename} declara un conteo territorial inconsistente.")

        missing_data = 0
        null_with_data = 0
        distribution_failures = 0
        for record in records:
            key = record.get("territorio_id")
            indicators = record.get("indicadores_pct", {})
            if set(indicators) != relative_ids:
                issues.append({"file": filename, "territory": key, "issue": "esquema_indicadores_incompleto"})
                continue
            source_row = territories.get(level, {}).get(key)
            has_data = bool(record.get("tiene_datos_socioeconomicos"))
            if has_data != bool(source_row and source_row.get("radio_count")):
                issues.append({"file": filename, "territory": key, "issue": "bandera_datos_inconsistente"})
            if not has_data:
                missing_data += 1
            for variable_id, value in indicators.items():
                expected = source_row.get("values", {}).get(variable_id) if source_row else None
                if value is None:
                    if has_data:
                        null_with_data += 1
                    if expected is not None:
                        issues.append({"file": filename, "territory": key, "variable": variable_id, "issue": "porcentaje_nulo_con_fuente"})
                    continue
                if not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100:
                    issues.append({"file": filename, "territory": key, "variable": variable_id, "issue": "porcentaje_fuera_de_rango"})
                if expected is None or abs(value - round(expected * 100, 4)) > 0.000001:
                    issues.append({"file": filename, "territory": key, "variable": variable_id, "issue": "porcentaje_no_coincide_con_consolidado"})
            for family, codes in COMPLETE_DISTRIBUTIONS.items():
                family_values = [indicators.get(code) for code in codes]
                if all(value is None for value in family_values):
                    continue
                if any(value is None for value in family_values) or abs(sum(family_values) - 100) > 0.011:
                    distribution_failures += 1
                    issues.append({"file": filename, "territory": key, "family": family, "issue": "distribucion_pct_no_cierra"})
            if level == "locality" and key[:5] != record.get("partido_id"):
                issues.append({"file": filename, "territory": key, "issue": "localidad_partido_inconsistente"})
            if level == "circuit":
                geo = circuit_props.get(key)
                if not geo or geo.get("partido_norm") != record.get("partido_id"):
                    issues.append({"file": filename, "territory": key, "issue": "circuito_partido_inconsistente"})
                relations = record.get("localidades_relacionadas", [])
                relation_ids = [item.get("clc") for item in relations]
                if len(relation_ids) != len(set(relation_ids)):
                    issues.append({"file": filename, "territory": key, "issue": "relacion_clc_duplicada"})
                if any(clc and clc[:5] != record.get("partido_id") for clc in relation_ids):
                    issues.append({"file": filename, "territory": key, "issue": "relacion_clc_interpartidaria"})
                primary = [item.get("clc") for item in relations if item.get("rol") == "principal"]
                expected_primary = record.get("localidad_principal_id")
                if (primary[0] if len(primary) == 1 else None) != expected_primary:
                    issues.append({"file": filename, "territory": key, "issue": "localidad_principal_inconsistente"})
        if null_with_data:
            critical.append(f"{filename} tiene {null_with_data} porcentajes nulos en territorios con datos.")
        if distribution_failures:
            critical.append(f"{filename} tiene {distribution_failures} distribuciones porcentuales que no cierran.")
        summary[level] = {
            "file": filename,
            "territories": len(records),
            "missing_data": missing_data,
            "distribution_failures": distribution_failures,
        }

    if issues:
        critical.append(f"Hay {len(issues)} inconsistencias en los JSON socioeconómicos consolidados.")
    return critical, issues, summary


def audit(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    variables = data.get("metadata", {}).get("variables", [])
    territories = data.get("territories", {})
    quality = data.get("quality", {})
    critical = []
    warnings = []

    ids = [variable.get("id") for variable in variables]
    duplicates = sorted(key for key, count in Counter(ids).items() if key and count > 1)
    if not variables:
        critical.append("No hay variables socioeconómicas declaradas.")
    if duplicates:
        critical.append(f"Códigos de variable duplicados: {', '.join(duplicates)}")

    metadata_issues = []
    variables_by_id = {variable.get("id"): variable for variable in variables}
    for index, variable in enumerate(variables, start=1):
        missing = sorted(field for field in REQUIRED_VARIABLE_FIELDS if field not in variable)
        if missing:
            metadata_issues.append({"row": index, "id": variable.get("id"), "missing": missing})
        if variable.get("metodo_agregacion") not in {"suma", "ratio_de_sumas"}:
            critical.append(f"Método de agregación inválido en {variable.get('id')!r}.")
        if variable.get("metodo_agregacion") == "ratio_de_sumas" and not variable.get("denominador"):
            critical.append(f"Falta denominador para {variable.get('id')!r}.")
    if metadata_issues:
        critical.append(f"Hay {len(metadata_issues)} variables con metadatos incompletos.")

    source_names = set(data.get("sources", {}).get("matrices", []))
    if source_names != EXPECTED_FULL_SOURCES:
        critical.append(f"Las fuentes finales no son las tres matrices completas esperadas: {sorted(source_names)}")
    source_audit = quality.get("source_audit", {})
    for source_id in ("a", "b", "c"):
        item = source_audit.get(source_id, {})
        if item.get("radios") != 23880 or item.get("duplicates") != 0:
            critical.append(f"La matriz completa {source_id.upper()} no cumple 23.880 radios únicos.")
    if not quality.get("source_key_sets_equal"):
        critical.append("Las claves de radio de las matrices completas no coinciden.")

    invalid_values = []
    distribution_issues = []
    count_ratio_issues = []
    observation_counts = {}
    for level in ("circuit", "locality", "party"):
        rows = territories.get(level)
        if not isinstance(rows, dict):
            critical.append(f"Falta el nivel territorial {level}.")
            continue
        counts_by_variable = Counter()
        for territory_key, row in rows.items():
            values = row.get("values", {})
            counts = row.get("counts", {})
            universes = row.get("universes", {})
            for family, codes in COMPLETE_DISTRIBUTIONS.items():
                available = [code for code in codes if code in values]
                if available and len(available) != len(codes):
                    distribution_issues.append({"level": level, "territory": territory_key, "family": family, "issue": "categorias_faltantes"})
                    continue
                if available:
                    value_sum = sum(values[code] for code in codes)
                    count_sum = sum(counts.get(code, 0) for code in codes)
                    family_universes = {universes.get(code) for code in codes}
                    if len(family_universes) != 1 or None in family_universes:
                        distribution_issues.append({"level": level, "territory": territory_key, "family": family, "issue": "universos_incompatibles"})
                    else:
                        universe = next(iter(family_universes))
                        if count_sum != universe:
                            distribution_issues.append({"level": level, "territory": territory_key, "family": family, "issue": "absolutos_no_cierran", "sum": count_sum, "universe": universe})
                    if abs(value_sum - 1) > 0.00005:
                        distribution_issues.append({"level": level, "territory": territory_key, "family": family, "issue": "porcentajes_no_cierran", "sum": value_sum})
            for variable_id, value in values.items():
                variable = variables_by_id.get(variable_id)
                if not variable:
                    invalid_values.append({"level": level, "territory": territory_key, "variable": variable_id, "issue": "variable_no_declarada"})
                    continue
                if not isinstance(value, (int, float)) or not math.isfinite(value):
                    invalid_values.append({"level": level, "territory": territory_key, "variable": variable_id, "issue": "valor_no_numerico"})
                    continue
                if value < 0:
                    invalid_values.append({"level": level, "territory": territory_key, "variable": variable_id, "issue": "valor_negativo"})
                if variable.get("unidad") == "proporción" and not 0 <= value <= 1:
                    invalid_values.append({"level": level, "territory": territory_key, "variable": variable_id, "issue": "proporcion_fuera_de_rango"})
                if variable.get("unidad") == "proporción":
                    numerator = counts.get(variable_id)
                    denominator = universes.get(variable_id)
                    if numerator is None or denominator is None or not denominator:
                        count_ratio_issues.append({"level": level, "territory": territory_key, "variable": variable_id, "issue": "absoluto_o_universo_faltante"})
                    elif abs(value - numerator / denominator) > 0.000001:
                        count_ratio_issues.append({"level": level, "territory": territory_key, "variable": variable_id, "issue": "ratio_inconsistente"})
                counts_by_variable[variable_id] += 1
        observation_counts[level] = dict(counts_by_variable)
        declared = quality.get("observations_by_level", {}).get(level, {})
        if declared != observation_counts[level]:
            critical.append(f"El conteo de observaciones declarado no cierra para {level}.")
    if invalid_values:
        critical.append(f"Hay {len(invalid_values)} valores socioeconómicos inválidos.")
    if distribution_issues:
        critical.append(f"Hay {len(distribution_issues)} distribuciones territoriales que no cierran.")
    if count_ratio_issues:
        critical.append(f"Hay {len(count_ratio_issues)} proporciones incompatibles con sus absolutos y universos.")

    profile_checks = quality.get("profile_distribution_checks", {})
    for family in COMPLETE_DISTRIBUTIONS:
        check = profile_checks.get(family, {})
        if check.get("status") != "complete" or abs((check.get("coverage") or 0) - 1) > 0.00000001:
            critical.append(f"El cierre provincial de {family} no es completo: {check.get('coverage')!r}.")
    education_total = profile_checks.get("educational_climate_total", {})
    if education_total.get("status") != "complete":
        critical.append("El total provincial de clima educativo, incluyendo no corresponde, no cierra.")
    warnings.append("Clima educativo usa como denominador los hogares clasificables; los casos 'No corresponde' se conservan en el control fuente y no se incorporan a la distribución sustantiva.")

    radio_count = quality.get("radio_count")
    mapped_radio_count = quality.get("mapped_radio_count")
    if radio_count != mapped_radio_count:
        critical.append(f"No cierra el universo de radios: matriz={radio_count}, mapeados={mapped_radio_count}.")
    radio_locality = quality.get("radio_locality_source_audit", {})
    if radio_locality.get("records") != 23880 or radio_locality.get("unique_clc") != 219:
        critical.append(f"La fuente radio-localidad no cumple 23.880 radios y 219 CLC: {radio_locality}.")
    if radio_locality.get("with_clc") != 19967 or radio_locality.get("without_clc") != 3913:
        critical.append(f"La cobertura radio-localidad cambió: {radio_locality}.")
    if len(territories.get("locality", {})) != 219:
        critical.append(
            f"El nivel localidad debe contener los 219 CLC oficiales y contiene "
            f"{len(territories.get('locality', {}))}."
        )
    cross_party = {(item.get("radio"), item.get("circuit")) for item in quality.get("cross_party_assignments", [])}
    unexpected_cross_party = cross_party - EXPECTED_PROVISIONAL_CROSS_PARTY
    if unexpected_cross_party:
        critical.append(f"Hay asignaciones interpartidarias nuevas no aprobadas: {sorted(unexpected_cross_party)}")
    if cross_party:
        warnings.append(f"Se mantienen {len(cross_party)} asignaciones interpartidarias provisionales derivadas del centroide de radio.")
    without_radios = set(quality.get("circuits_without_radios", []))
    unexpected_without_radios = without_radios - EXPECTED_CIRCUITS_WITHOUT_RADIOS
    if unexpected_without_radios:
        critical.append(f"Hay circuitos sin radio fuera del inventario aprobado: {sorted(unexpected_without_radios)}")
    if without_radios:
        warnings.append(f"Los circuitos {', '.join(sorted(without_radios))} quedan sin indicadores; no se imputan valores.")
    if not quality.get("provisional_centroid_mapping"):
        critical.append("La procedencia provisional por centroide no está declarada.")

    consolidated_critical, consolidated_issues, consolidated_summary = audit_consolidated(
        path.parent, variables, territories
    )
    critical.extend(consolidated_critical)

    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source": str(path),
        "status": "ok" if not critical else "critical",
        "critical": critical,
        "warnings": warnings,
        "summary": {
            "variables": len(variables), "radios": radio_count,
            "territories": {level: len(territories.get(level, {})) for level in ("circuit", "locality", "party")},
            "invalid_values": len(invalid_values), "distribution_issues": len(distribution_issues),
            "count_ratio_issues": len(count_ratio_issues),
            "complete_distributions": len(COMPLETE_DISTRIBUTIONS),
            "cross_party_assignments": len(cross_party),
            "circuits_without_radios": sorted(without_radios),
            "locality_radio_coverage": quality.get("locality_radio_coverage"),
            "consolidated_exports": consolidated_summary,
        },
        "details": {
            "metadata_issues": metadata_issues, "source_audit": source_audit,
            "invalid_values": invalid_values[:100], "distribution_issues": distribution_issues[:100],
            "count_ratio_issues": count_ratio_issues[:100],
            "profile_distribution_checks": profile_checks,
            "observations_by_level": observation_counts,
            "consolidated_issues": consolidated_issues[:200],
        },
    }


def markdown(report):
    summary = report["summary"]
    coverage = summary.get("locality_radio_coverage")
    coverage_label = f"{coverage * 100:.2f}%" if coverage is not None else "s/d"
    lines = [
        "# Auditoría socioeconómica", "", f"Estado: **{report['status'].upper()}**", "",
        "## Resumen", "", f"- Variables: {fmt_int(summary['variables'])}",
        f"- Radios: {fmt_int(summary['radios'])}",
        f"- Territorios: {', '.join(f'{level}={fmt_int(count)}' for level, count in summary['territories'].items())}",
        f"- Distribuciones completas auditadas: {fmt_int(summary['complete_distributions'])}",
        f"- Valores inválidos: {fmt_int(summary['invalid_values'])}",
        f"- Distribuciones territoriales con cierre inválido: {fmt_int(summary['distribution_issues'])}",
        f"- Proporciones incompatibles con absolutos/universos: {fmt_int(summary['count_ratio_issues'])}",
        f"- Cobertura de radios con localidad: {coverage_label}", "",
        "## Observaciones metodológicas", "",
    ]
    lines.extend(f"- {item}" for item in report["warnings"] or ["Sin observaciones."])
    lines.extend(["", "## Errores críticos", ""])
    lines.extend(f"- {item}" for item in report["critical"] or ["Ninguno."])
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Audita el dataset socioeconómico del Atlas Electoral PBA")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    report = audit(input_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "auditoria_socioeconomica.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "auditoria_socioeconomica.md").write_text(markdown(report), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    if report["critical"]:
        raise SystemExit("Auditoría socioeconómica con errores críticos")


if __name__ == "__main__":
    main()
