import argparse
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from xlsx_reader import iter_xlsx_rows
from radio_locality import DEFAULT_NOMENCLATOR, RADIO_LOCALITY_FILE, load_nomenclator, load_radio_localities


APP_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATA_ROOT = Path(r"G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos")
DEFAULT_OUTPUT = APP_DIR / "data" / "socioeconomic_data.json"
FINAL_OUTPUT_NAMES = {
    "party": "partidos_socioeconomicos.json",
    "locality": "localidades_socioeconomicas.json",
    "circuit": "circuitos_socioeconomicos.json",
}

FULL_SOCIO_SUBDIR = "Full"
FULL_SOURCE_SCHEMAS = {
    "a": {
        "file": "MDO_socioeconómica_radios_Provincia_Bs_As (a).xlsx",
        "key": 0,
        "fields": {
            "Totaledu": 1, "eduhog1P": 2, "eduhog2P": 3, "eduhog3P": 4,
            "eduhog4P": 5, "eduhog5P": 6, "eduhog_no_corresponde": 7,
            "eduhog_mv": 8, "eduhog_na": 9,
            "Totalh24": 10, "h24c_1P": 11, "h24c_2P": 12,
            "Totalnbi": 15, "nbi_tot_1P": 16, "nbi_tot_2P": 17,
            "Total919": 20, "p19_1P": 21, "p19_2P": 22, "p19_3P": 23,
            "Totalp20": 26, "p20_1P": 27, "p20_2P": 28,
            "Totalcond": 31, "condac_1P": 32, "condac_2P": 33, "condac_3P": 34,
            "Totalp30": 37, "P30_1P": 38, "p30_2P": 39, "p30_3P": 40,
            "p30_4P": 41, "p30_5P": 42, "p30_6P": 43,
        },
    },
    "b": {
        "file": "MDO_socioeconómica_radios_Provincia_Bs_As (b).xlsx",
        "key": 1,
        "fields": {
            "Total": 2,
            **{letter: 3 + index for index, letter in enumerate("ABCDEFGHIJKLMNOPQRSTU")},
            "V": 24, "Z": 25,
        },
    },
    "c": {
        "file": "MDO_socioeconómica_radios_Provincia_Bs_As (c).xlsx",
        "key": 1,
        "fields": {
            "Total_01_1": 2,
            **{f"v01_1ocup_{index}P": 2 + index for index in range(1, 9)},
            "hacin_5P": 13, "hacin_1P": 14, "h22_1P": 15, "hacin_2P": 16,
            "h22_2P": 17, "hacin_3P": 18, "h22_3P": 19, "hacin_4P": 20,
            "h22_4P": 21, "inmat_3P": 22, "h22_5P": 23, "hacin_6P": 24,
            "Totalinmat": 27, "inmat_1P": 28, "inmat_2P": 29,
            "Totalh22": 30, "inmat_4P": 31, "inmat_5P": 32,
            "Totalhacin": 35, "Totaledad": 38,
            **{f"edad_q{index}": 38 + index for index in range(1, 23)},
            "edad_mv": 61, "edad_na": 62,
            "Totalp17": 63, "P17_1P": 64, "p17_2P": 65, "p17_3P": 66,
            "p17_4P": 67, "p17_5P": 68, "p17_mv": 69, "p17_na": 70,
        },
    },
}

DESCRIPTORS_FILE = "Descriptores Matriz de Datos Socioeconómicos.xlsx"
RADIO_CIRCUIT_FILE = "Circuitos_Radios_uno_a_muchos.xlsx"
SOURCE_NAME = "INDEC · Censo Nacional de Población, Hogares y Viviendas 2022"


SUPPLEMENTAL_VARIABLES = [
    ("eduhog3P", "Clima educativo del hogar: Medio", "Medio", "Totaledu_clasificable", "Hogares con clima educativo clasificable", "Capital humano"),
    ("h24c_2P", "Acceso a computadora o tablet: No", "Sin computadora o tablet", "Totalh24", "Hogares", "Acceso a información y comunicación"),
    ("nbi_tot_2P", "NBI vivienda inconveniente: No", "Sin NBI de vivienda inconveniente", "Totalnbi", "Hogares", "Necesidades básicas insatisfechas"),
    ("p20_2P", "Cobra jubilación o pensión: No", "No percibe jubilación o pensión", "Totalp20", "Población", "Protección social"),
    ("condac_1P", "Condición de actividad: Ocupado", "Ocupados", "Totalcond", "Población en edad de trabajar", "Mercado de trabajo"),
    ("condac_3P", "Condición de actividad: Inactivo", "Inactivos", "Totalcond", "Población en edad de trabajar", "Mercado de trabajo"),
    ("p30_6P", "Categoría ocupacional: Ignorado", "Categoría ignorada", "Totalp30", "Población ocupada", "Mercado de trabajo"),
    ("U", "Rama de actividad: Organizaciones y órganos extraterritoriales", "Organizaciones extraterritoriales", "Total", "Población ocupada", "Mercado de trabajo"),
    ("V", "Rama de actividad: Sin respuesta", "Sin respuesta", "Total", "Población ocupada", "Mercado de trabajo"),
    ("Z", "Rama de actividad: Información insuficiente para codificar", "Información insuficiente", "Total", "Población ocupada", "Mercado de trabajo"),
    ("v01_1ocup_3P", "Tipo de vivienda: Rancho", "Rancho", "Total_01_1", "Viviendas particulares ocupadas", "Vivienda"),
    ("v01_1ocup_4P", "Tipo de vivienda: Casilla", "Casilla", "Total_01_1", "Viviendas particulares ocupadas", "Vivienda"),
    ("v01_1ocup_5P", "Tipo de vivienda: Departamento", "Departamento", "Total_01_1", "Viviendas particulares ocupadas", "Vivienda"),
    ("v01_1ocup_6P", "Tipo de vivienda: Pieza en inquilinato, hotel o pensión", "Inquilinato, hotel o pensión", "Total_01_1", "Viviendas particulares ocupadas", "Vivienda"),
    ("v01_1ocup_7P", "Tipo de vivienda: Local no construido para habitación", "Local no construido para habitación", "Total_01_1", "Viviendas particulares ocupadas", "Vivienda"),
    ("v01_1ocup_8P", "Tipo de vivienda: Vivienda móvil", "Vivienda móvil", "Total_01_1", "Viviendas particulares ocupadas", "Vivienda"),
    ("hacin_2P", "Hacinamiento: 0,51 a 0,99 personas por cuarto", "0,51–0,99 personas por cuarto", "Totalhacin", "Hogares", "Vivienda"),
    ("hacin_3P", "Hacinamiento: 1,00 a 1,49 personas por cuarto", "1,00–1,49 personas por cuarto", "Totalhacin", "Hogares", "Vivienda"),
    ("hacin_4P", "Hacinamiento: 1,50 a 1,99 personas por cuarto", "1,50–1,99 personas por cuarto", "Totalhacin", "Hogares", "Vivienda"),
    ("hacin_5P", "Hacinamiento: 2,00 a 3,00 personas por cuarto", "2,00–3,00 personas por cuarto", "Totalhacin", "Hogares", "Vivienda"),
    ("inmat_2P", "Calidad de materiales: Calidad II", "Calidad II", "Totalinmat", "Viviendas particulares ocupadas", "Vivienda"),
    ("inmat_3P", "Calidad de materiales: Calidad III", "Calidad III", "Totalinmat", "Viviendas particulares ocupadas", "Vivienda"),
    ("inmat_5P", "Calidad de materiales: Ignorado", "Calidad ignorada", "Totalinmat", "Viviendas particulares ocupadas", "Vivienda"),
    ("h22_3P", "Tenencia de la vivienda: Cedida por trabajo", "Cedida por trabajo", "Totalh22", "Hogares", "Vivienda"),
    ("h22_5P", "Tenencia de la vivienda: Otra situación", "Otra situación", "Totalh22", "Hogares", "Vivienda"),
    ("p17_5P", "Lugar de residencia hace 5 años: No había nacido", "No había nacido", "Totalp17", "Población", "Composición etaria y migratoria"),
]

DERIVED_VARIABLES = ({
    "id": "poblacion_total",
    "nombre_corto": "Población total",
    "descripcion": "Población total derivada del denominador común de los cuatro grupos de edad.",
    "fuente": SOURCE_NAME,
    "anio": 2022,
    "universo": "Población",
    "tipo": "absoluta",
    "unidad": "personas",
    "numerador": "Totaledad",
    "denominador": None,
    "metodo_agregacion": "suma",
    "decimales": 0,
    "grupo_tematico": "Composición etaria y migratoria",
    "agregable_en": ["circuit", "locality", "party"],
    "derivada": True,
},)


def norm_text(value):
    return str(value or "").strip()


def norm_field(value):
    text = unicodedata.normalize("NFD", norm_text(value).casefold())
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def norm_radio(value):
    text = norm_text(value)
    if re.fullmatch(r"\d+(?:\.0+)?", text):
        return text.split(".", 1)[0].zfill(9)
    return ""


def norm_circuit(value):
    text = norm_text(value).upper()
    if re.fullmatch(r"\d+", text):
        return str(int(text))
    match = re.fullmatch(r"0*(\d+)([A-Z]+)", text)
    if match:
        return f"{int(match.group(1))}{match.group(2)}"
    return text.lstrip("0") or text


def as_number(value):
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def denominator_for(variable_id):
    code = norm_field(variable_id)
    prefix_map = (
        ("eduhog", "Totaledu_clasificable"), ("h24c_", "Totalh24"),
        ("nbi_tot_", "Totalnbi"), ("p19_", "Total919"), ("p20_", "Totalp20"),
        ("condac_", "Totalcond"), ("p30_", "Totalp30"),
        ("v01_1ocup_", "Total_01_1"), ("hacin_", "Totalhacin"),
        ("inmat_", "Totalinmat"), ("h22_", "Totalh22"),
        ("edad", "Totaledad"), ("p17_", "Totalp17"),
    )
    for prefix, denominator in prefix_map:
        if code.startswith(norm_field(prefix)):
            return denominator
    if re.fullmatch(r"[a-z]", code):
        return "Total"
    return None


def universe_for(variable_id):
    code = norm_field(variable_id)
    if code.startswith("eduhog"):
        return "Hogares con clima educativo clasificable"
    if code.startswith(("h24c_", "nbi_tot_", "hacin_", "h22_")):
        return "Hogares"
    if code.startswith(("v01_1ocup_", "inmat_")):
        return "Viviendas particulares ocupadas"
    if code.startswith("p30_") or re.fullmatch(r"[a-z]", code):
        return "Población ocupada"
    if code.startswith("condac_"):
        return "Población en edad de trabajar"
    return "Población"


def short_variable_name(variable_label, category):
    base = re.split(r"\s*\([^)]*\)\s*:|:", variable_label, maxsplit=1)[0].strip()
    return f"{base}: {category}" if base and category else base or category


def variable_record(code, name, description, denominator, universe, group):
    return {
        "id": code, "nombre_corto": name, "descripcion": description,
        "fuente": SOURCE_NAME, "anio": 2022, "universo": universe,
        "tipo": "proporcion", "unidad": "proporción", "numerador": code,
        "denominador": denominator, "metodo_agregacion": "ratio_de_sumas",
        "decimales": 6, "grupo_tematico": group,
        "agregable_en": ["circuit", "locality", "party"],
    }


def load_descriptors(path):
    rows = iter_xlsx_rows(path)
    header = next(rows, None)
    if not header:
        raise ValueError(f"{path.name}: diccionario vacío")
    columns = {norm_field(value): index for index, value in enumerate(header)}
    required = {"dimension", "variables cnphv 2022", "codigo", "descripcion"}
    missing = required - set(columns)
    if missing:
        raise ValueError(f"{path.name}: faltan columnas: {', '.join(sorted(missing))}")
    variables = []
    last_dimension = ""
    last_variable = ""
    seen = set()
    for row in rows:
        dimension = norm_text(row[columns["dimension"]] if columns["dimension"] < len(row) else None)
        label = norm_text(row[columns["variables cnphv 2022"]] if columns["variables cnphv 2022"] < len(row) else None)
        code = norm_text(row[columns["codigo"]] if columns["codigo"] < len(row) else None)
        category = norm_text(row[columns["descripcion"]] if columns["descripcion"] < len(row) else None)
        if dimension:
            last_dimension = dimension
        if label:
            last_variable = label
        if not code:
            continue
        code_key = norm_field(code)
        if code_key in seen:
            raise ValueError(f"{path.name}: código duplicado {code}")
        seen.add(code_key)
        denominator = denominator_for(code)
        variables.append(variable_record(
            code,
            short_variable_name(last_variable, category),
            f"{last_variable} Categoría: {category}".strip(),
            denominator,
            universe_for(code),
            last_dimension,
        ))
    for code, name, category, denominator, universe, group in SUPPLEMENTAL_VARIABLES:
        if norm_field(code) in seen:
            continue
        variables.append(variable_record(code, name, f"{name}. Categoría recuperada de la matriz completa: {category}.", denominator, universe, group))
        seen.add(norm_field(code))
    variables.extend(DERIVED_VARIABLES)
    return variables


def load_full_matrix(path, schema):
    output = {}
    duplicate_keys = []
    nondata_rows = 0
    for row in iter_xlsx_rows(path):
        key = norm_radio(row[schema["key"]] if schema["key"] < len(row) else None)
        if not key:
            nondata_rows += 1
            continue
        if key in output:
            duplicate_keys.append(key)
            continue
        values = {}
        for field, index in schema["fields"].items():
            value = as_number(row[index] if index < len(row) else None)
            if value is not None:
                values[field] = value
        if "Totaledad" in values:
            values["EDAD0_14"] = sum(values.get(f"edad_q{index}", 0) for index in range(1, 4))
            values["EDAD15_29"] = sum(values.get(f"edad_q{index}", 0) for index in range(4, 7))
            values["EDAD30_54"] = sum(values.get(f"edad_q{index}", 0) for index in range(7, 12))
            values["EDAD55yMas"] = sum(values.get(f"edad_q{index}", 0) for index in range(12, 23))
        if "Totaledu" in values:
            values["Totaledu_clasificable"] = sum(values.get(field, 0) for field in ("eduhog1P", "eduhog2P", "eduhog3P", "eduhog4P", "eduhog5P"))
        output[key] = values
    if duplicate_keys:
        raise ValueError(f"{path.name}: radios duplicados: {duplicate_keys[:10]}")
    return output, {"radios": len(output), "duplicates": 0, "nondata_rows": nondata_rows}


def load_radio_mapping(path):
    rows = iter_xlsx_rows(path)
    header = next(rows, None)
    columns = {norm_field(value): index for index, value in enumerate(header or [])}
    if not {"recode", "circuito"}.issubset(columns):
        raise ValueError(f"{path.name}: se requieren RECODE y circuito")
    mapping = {}
    duplicate_pairs = 0
    multi_assigned = set()
    for row in rows:
        radio = norm_radio(row[columns["recode"]] if columns["recode"] < len(row) else None)
        circuit = norm_circuit(row[columns["circuito"]] if columns["circuito"] < len(row) else None)
        if not radio or not circuit:
            raise ValueError(f"{path.name}: clave vacía en la relación radio-circuito")
        if radio in mapping:
            if mapping[radio] == circuit:
                duplicate_pairs += 1
            else:
                multi_assigned.add(radio)
            continue
        mapping[radio] = circuit
    if duplicate_pairs or multi_assigned:
        raise ValueError(f"{path.name}: duplicados={duplicate_pairs}, radios con varios circuitos={len(multi_assigned)}")
    return mapping


def load_circuit_geography(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    return {feature["properties"]["key"]: feature["properties"] for feature in data.get("features", [])}


def empty_aggregate():
    return {"radio_count": 0, "cross_party_radios": 0, "sums": defaultdict(float)}


def add_radio(bucket, values, cross_party):
    bucket["radio_count"] += 1
    if cross_party:
        bucket["cross_party_radios"] += 1
    for field, value in values.items():
        if value is not None:
            bucket["sums"][field] += value


def finalize_territories(buckets, variables):
    output = {}
    observation_counts = Counter()
    for key, bucket in buckets.items():
        values = {}
        counts = {}
        universes = {}
        for variable in variables:
            numerator = bucket["sums"].get(variable["numerador"])
            denominator_name = variable.get("denominador")
            if denominator_name:
                denominator = bucket["sums"].get(denominator_name)
                value = numerator / denominator if numerator is not None and denominator else None
                if numerator is not None:
                    counts[variable["id"]] = round(numerator)
                if denominator is not None:
                    universes[variable["id"]] = round(denominator)
            else:
                value = numerator
                if numerator is not None:
                    counts[variable["id"]] = round(numerator)
            if value is not None:
                observation_counts[variable["id"]] += 1
                values[variable["id"]] = round(value, variable["decimales"])
        output[key] = {
            "radio_count": bucket["radio_count"],
            "cross_party_radios": bucket["cross_party_radios"],
            "values": values,
            "counts": counts,
            "universes": universes,
        }
    return output, dict(observation_counts)


DISTRIBUTIONS = {
    "population_age": (["EDAD0_14", "EDAD15_29", "EDAD30_54", "EDAD55yMas"], "Totaledad"),
    "migration": (["P17_1P", "p17_2P", "p17_3P", "p17_4P", "p17_5P"], "Totalp17"),
    "educational_climate": (["eduhog1P", "eduhog2P", "eduhog3P", "eduhog4P", "eduhog5P"], "Totaledu_clasificable"),
    "educational_climate_total": (["eduhog1P", "eduhog2P", "eduhog3P", "eduhog4P", "eduhog5P", "eduhog_no_corresponde", "eduhog_mv", "eduhog_na"], "Totaledu"),
    "digital_access": (["h24c_1P", "h24c_2P"], "Totalh24"),
    "nbi_housing": (["nbi_tot_1P", "nbi_tot_2P"], "Totalnbi"),
    "health_coverage": (["p19_1P", "p19_2P", "p19_3P"], "Total919"),
    "pension": (["p20_1P", "p20_2P"], "Totalp20"),
    "activity": (["condac_1P", "condac_2P", "condac_3P"], "Totalcond"),
    "occupational_category": (["P30_1P", "p30_2P", "p30_3P", "p30_4P", "p30_5P", "p30_6P"], "Totalp30"),
    "activity_branch": (list("ABCDEFGHIJKLMNOPQRSTU") + ["V", "Z"], "Total"),
    "housing_type": ([f"v01_1ocup_{index}P" for index in range(1, 9)], "Total_01_1"),
    "overcrowding": ([f"hacin_{index}P" for index in range(1, 7)], "Totalhacin"),
    "material_quality": ([f"inmat_{index}P" for index in range(1, 6)], "Totalinmat"),
    "housing_tenure": ([f"h22_{index}P" for index in range(1, 6)], "Totalh22"),
}


def distribution_quality(radio_values):
    def total(field):
        return sum(values.get(field, 0) for values in radio_values.values())

    output = {}
    for family, (categories, denominator) in DISTRIBUTIONS.items():
        category_sum = sum(total(field) for field in categories)
        denominator_sum = total(denominator)
        output[family] = {
            "categories": categories,
            "denominator": denominator,
            "category_sum": category_sum,
            "denominator_sum": denominator_sum or None,
            "coverage": round(category_sum / denominator_sum, 8) if denominator_sum else None,
            "difference": denominator_sum - category_sum if denominator_sum else None,
            "status": "complete" if denominator_sum and category_sum == denominator_sum else "incomplete",
        }
    return output


def consolidated_record(level, key, source_row, relative_variables, circuit_geo, locality_nomenclator, party_names):
    source_row = source_row or {}
    values = source_row.get("values", {})
    universes = source_row.get("universes", {})
    indicators = {
        variable["id"]: round(values[variable["id"]] * 100, 4) if values.get(variable["id"]) is not None else None
        for variable in relative_variables
    }
    denominator_values = {}
    for variable in relative_variables:
        denominator = variable.get("denominador")
        universe = universes.get(variable["id"])
        if denominator and universe is not None:
            previous = denominator_values.setdefault(denominator, universe)
            if previous != universe:
                raise ValueError(f"Universos incompatibles en {level} {key}: {denominator}")
    record = {
        "territorio_id": key,
        "nivel": {"party": "partido", "locality": "localidad", "circuit": "circuito"}[level],
        "tiene_datos_socioeconomicos": bool(source_row.get("radio_count")),
        "cantidad_radios": source_row.get("radio_count", 0),
        "indicadores_pct": indicators,
        "valores_absolutos": {
            "poblacion_total": round(values["poblacion_total"]) if values.get("poblacion_total") is not None else None,
        },
        "universos": denominator_values,
    }
    if level == "party":
        record.update({"partido_id": key, "partido": party_names.get(key, key)})
    elif level == "locality":
        locality = locality_nomenclator[key]
        record.update({
            "partido_id": locality["party_code"],
            "partido": locality["party_name"],
            "localidad_id": key,
            "localidad": locality["name"],
        })
    else:
        props = circuit_geo[key]
        record.update({
            "partido_id": props.get("partido_norm"),
            "partido": props.get("partido"),
            "localidad_principal_id": props.get("localidad_clc"),
            "localidad_principal": props.get("localidad"),
            "circuito_id": key,
            "circuito": props.get("circuito") or key,
            "localidades_relacionadas": props.get("localidad_relaciones", []),
        })
    return record


def consolidated_payload(level, territories, variables, circuit_geo, locality_nomenclator):
    relative_variables = [variable for variable in variables if variable.get("tipo") == "proporcion"]
    party_names = {}
    for props in circuit_geo.values():
        party_code = norm_text(props.get("partido_norm"))
        if party_code:
            party_names.setdefault(party_code, norm_text(props.get("partido")) or party_code)
    if level == "circuit":
        keys = sorted(circuit_geo, key=lambda value: (len(value), value))
    elif level == "locality":
        keys = sorted(locality_nomenclator)
    else:
        keys = sorted(party_names)
    records = [
        consolidated_record(level, key, territories.get(level, {}).get(key), relative_variables, circuit_geo, locality_nomenclator, party_names)
        for key in keys
    ]
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "metadata": {
            "schema_version": 1,
            "nivel": {"party": "Partido", "locality": "Localidad", "circuit": "Circuito"}[level],
            "territory_count": len(records),
            "relative_scale": "porcentaje_0_100",
            "null_policy": "null indica que no existe un denominador confiable para la unidad; no se imputa.",
            "distribution_tolerance_pp": 0.01,
            "indicators": [
                {
                    "id": variable["id"],
                    "nombre": variable["nombre_corto"],
                    "descripcion": variable["descripcion"],
                    "universo": variable["universo"],
                    "denominador": variable.get("denominador"),
                    "grupo_tematico": variable["grupo_tematico"],
                    "fuente": variable["fuente"],
                    "anio": variable["anio"],
                    "unidad": "porcentaje",
                }
                for variable in relative_variables
            ],
            "distributions": {family: categories for family, (categories, _) in DISTRIBUTIONS.items() if family != "educational_climate_total"},
            "secondary_absolute_values": ["poblacion_total"],
            "methodology_notes": [
                "Los porcentajes se calculan como ratio de sumas de numeradores y denominadores.",
                "Localidad se agrega directamente desde CLC de radio; circuito y partido se agregan desde sus relaciones territoriales.",
                "Los resultados electorales no forman parte de estos archivos y no se redistribuyen entre localidades.",
            ],
        },
        "territories": records,
    }


def write_consolidated_outputs(output_dir, territories, variables, circuit_geo, locality_nomenclator):
    summaries = {}
    for level, filename in FINAL_OUTPUT_NAMES.items():
        payload = consolidated_payload(level, territories, variables, circuit_geo, locality_nomenclator)
        path = output_dir / filename
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        summaries[level] = {"file": filename, "territories": len(payload["territories"])}
    return summaries


def build(data_root, output_path):
    socio_dir = data_root / "04_Socioeconomicos"
    full_dir = socio_dir / FULL_SOCIO_SUBDIR
    variables = load_descriptors(socio_dir / DESCRIPTORS_FILE)

    loaded = {}
    source_audit = {}
    for source_id, schema in FULL_SOURCE_SCHEMAS.items():
        path = full_dir / schema["file"]
        loaded[source_id], source_audit[source_id] = load_full_matrix(path, schema)
        source_audit[source_id]["file"] = schema["file"]
    key_sets = [set(matrix) for matrix in loaded.values()]
    if any(keys != key_sets[0] for keys in key_sets[1:]):
        raise ValueError("Las tres matrices socioeconómicas completas no tienen el mismo universo de radios")
    radio_values = {
        radio: {**loaded["a"][radio], **loaded["b"][radio], **loaded["c"][radio]}
        for radio in loaded["a"]
    }
    available_fields = set().union(*(values.keys() for values in radio_values.values()))
    missing_variables = sorted({variable["numerador"] for variable in variables} - available_fields, key=norm_field)
    missing_denominators = sorted({variable["denominador"] for variable in variables if variable.get("denominador")} - available_fields, key=norm_field)
    if missing_variables or missing_denominators:
        raise ValueError(f"Campos faltantes en matrices completas: variables={missing_variables}, denominadores={missing_denominators}")

    mapping = load_radio_mapping(socio_dir / RADIO_CIRCUIT_FILE)
    radio_locality, radio_locality_audit = load_radio_localities(socio_dir / RADIO_LOCALITY_FILE)
    locality_nomenclator, nomenclator_source = load_nomenclator(DEFAULT_NOMENCLATOR)
    radio_keys = set(radio_values)
    if radio_keys != set(mapping):
        raise ValueError(
            f"No cierra el universo radio-matriz/mapeo: matrices={len(radio_keys)}, mapeo={len(mapping)}, "
            f"sin_mapeo={len(radio_keys - set(mapping))}, sin_matriz={len(set(mapping) - radio_keys)}"
        )
    if radio_keys != set(radio_locality):
        raise ValueError(
            f"No cierra el universo radio-matriz/localidad: matrices={len(radio_keys)}, "
            f"radio_localidad={len(radio_locality)}, sin_localidad={len(radio_keys - set(radio_locality))}, "
            f"sin_matriz={len(set(radio_locality) - radio_keys)}"
        )

    circuit_geo = load_circuit_geography(APP_DIR / "data" / "circuitos_pba.geojson")
    buckets = {level: defaultdict(empty_aggregate) for level in ("circuit", "locality", "party")}
    cross_party = []
    missing_circuit_geometry = []
    radios_with_locality = 0
    for radio, circuit in mapping.items():
        geo = circuit_geo.get(circuit)
        if not geo:
            missing_circuit_geometry.append({"radio": radio, "circuit": circuit})
            continue
        radio_party = radio[:5]
        circuit_party = norm_text(geo.get("partido_norm"))
        is_cross_party = bool(radio_party and circuit_party and radio_party != circuit_party)
        if is_cross_party:
            cross_party.append({"radio": radio, "radio_party": radio_party, "circuit": circuit, "circuit_party": circuit_party})
        values = radio_values[radio]
        add_radio(buckets["circuit"][circuit], values, is_cross_party)
        add_radio(buckets["party"][radio_party], values, False)
        locality_key = radio_locality[radio]["clc"]
        if locality_key:
            if locality_key not in locality_nomenclator:
                raise ValueError(f"CLC sin nomenclador: {locality_key}")
            radios_with_locality += 1
            add_radio(buckets["locality"][locality_key], values, False)
    if missing_circuit_geometry:
        raise ValueError(f"Relaciones radio-circuito sin geometría: {missing_circuit_geometry[:10]}")

    territories = {}
    observations = {}
    for level in ("circuit", "locality", "party"):
        territories[level], observations[level] = finalize_territories(buckets[level], variables)

    circuits_without_radios = sorted(set(circuit_geo) - set(buckets["circuit"]), key=lambda value: (len(value), value))
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "metadata": {
            "variables": variables,
            "levels": {"circuit": "Circuito electoral", "locality": "Localidad", "party": "Partido"},
            "relative_values": "values guarda proporciones; counts guarda numeradores absolutos y universes sus denominadores territoriales.",
        },
        "quality": {
            "radio_count": len(radio_values), "mapped_radio_count": len(mapping),
            "source_audit": source_audit, "source_key_sets_equal": True,
            "cross_party_assignments": cross_party,
            "circuits_with_radios": len(buckets["circuit"]),
            "circuits_without_radios": circuits_without_radios,
            "radios_with_locality": radios_with_locality,
            "radios_without_locality": len(mapping) - radios_with_locality,
            "locality_radio_coverage": round(radios_with_locality / len(mapping), 6) if mapping else None,
            "radio_locality_source_audit": radio_locality_audit,
            "locality_count": len(locality_nomenclator),
            "observations_by_level": observations,
            "profile_distribution_checks": distribution_quality(radio_values),
            "provisional_centroid_mapping": True,
        },
        "territories": territories,
        "sources": {
            "dictionary": DESCRIPTORS_FILE,
            "matrices": [schema["file"] for schema in FULL_SOURCE_SCHEMAS.values()],
            "matrix_subdirectory": FULL_SOCIO_SUBDIR,
            "radio_circuit": RADIO_CIRCUIT_FILE,
            "radio_locality": RADIO_LOCALITY_FILE,
            "locality_nomenclator": "data/localidades_pba_mas2000.json",
            "locality_nomenclator_source": nomenclator_source,
            "reference_year": 2022,
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload["quality"]["consolidated_exports"] = write_consolidated_outputs(
        output_path.parent, territories, variables, circuit_geo, locality_nomenclator
    )
    output_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return payload


def parse_args():
    parser = argparse.ArgumentParser(description="Construye agregados socioeconómicos del Atlas Electoral PBA")
    parser.add_argument("--data-root", default=os.environ.get("ATLAS_DATA_ROOT", str(DEFAULT_DATA_ROOT)))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    return parser.parse_args()


def main():
    args = parse_args()
    payload = build(Path(args.data_root).resolve(), Path(args.output).resolve())
    print(Path(args.output).resolve())
    print(f"{len(payload['metadata']['variables'])} variables, {payload['quality']['radio_count']} radios, {len(payload['territories']['circuit'])} circuitos")


if __name__ == "__main__":
    main()
