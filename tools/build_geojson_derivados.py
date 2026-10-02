#!/usr/bin/env python3
"""Genera GeoJSON territoriales con indicadores electorales y socioeconomicos.

Fuentes de verdad:
  - data/electoral_data.json
  - data/{partidos,localidades,circuitos}_socioeconomicos.json
  - data/{partidos_pba,localidades_pba_mas2000,circuitos_pba}.geojson

No lee archivos DINE ni planillas socioeconomicas. Los porcentajes electorales
se calculan desde los conteos consolidados y la continuidad replica la regla
vigente en js/app.js sin comparar porcentajes redondeados.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
import unicodedata
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_OUTPUT_DIR = DEFAULT_DATA_DIR / "derivados"

LEVELS = {
    "partido": {
        "electoral_key": "party",
        "geometry": "partidos_pba.geojson",
        "socio": "partidos_socioeconomicos.json",
        "output": "partidos_indicadores.geojson",
        "feature_key": "key",
    },
    "localidad": {
        "electoral_key": "locality",
        "geometry": "localidades_pba_mas2000.geojson",
        "socio": "localidades_socioeconomicas.json",
        "output": "localidades_indicadores.geojson",
        "feature_key": "localidad_key",
    },
    "circuito": {
        "electoral_key": "circuit",
        "geometry": "circuitos_pba.geojson",
        "socio": "circuitos_socioeconomicos.json",
        "output": "circuitos_indicadores.geojson",
        "feature_key": "key",
    },
}

CONTINUITY_LABELS = {
    "always_win": "Siempre gana",
    "always_lose": "Siempre pierde",
    "alternation": "Alternancia",
    "tie": "Empate o sin definición",
    "incomplete": "Datos incompletos",
}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def ascii_slug(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or "").lower())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return re.sub(r"_+", "_", text)


def compact_words(value: str, aliases: dict[str, str]) -> str:
    slug = ascii_slug(value)
    if slug in aliases:
        return aliases[slug]
    words = [word for word in slug.split("_") if word not in {"de", "del", "y", "la", "el"}]
    return "_".join(word[:3] for word in words) or "s_d"


def election_suffix(source: dict[str, Any]) -> str:
    year = str(source.get("year") or "")[-2:] or "sd"
    election_type = compact_words(
        source.get("election_type") or "",
        {"general": "gen", "generales": "gen", "segunda_vuelta": "bal"},
    )
    cargo = compact_words(
        source.get("cargo") or "",
        {
            "diputados_nacionales": "dip",
            "diputado_nacional": "dip",
            "gobernador": "gob",
            "gobernador_a": "gob",
            "presidente": "pre",
            "presidente_a": "pre",
            "presidente_y_vice": "pre",
        },
    )
    return f"{year}_{election_type}_{cargo}"


def build_election_fields(sources: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    used: set[str] = set()
    for source in sources:
        suffix = election_suffix(source)
        if suffix in used:
            raise ValueError(f"Sufijo electoral duplicado: {suffix}")
        used.add(suffix)
        result[source["id"]] = {"per": f"per_{suffix}", "aus": f"aus_{suffix}", "suffix": suffix}
    return result


def socioeconomic_fields(metadata: dict[str, Any]) -> dict[str, dict[str, str]]:
    result = {"pct": {}, "absolute": {}, "universe": {}}
    used: set[str] = set()

    def reserve(candidate: str, source_id: str) -> str:
        field = candidate
        suffix = 2
        while field in used:
            field = f"{candidate}_{suffix}"
            suffix += 1
        used.add(field)
        return field

    for indicator in metadata.get("indicators", []):
        source_id = str(indicator["id"])
        base = ascii_slug(source_id)
        if source_id.lower().endswith("p") and base.endswith("p"):
            base = base[:-1].rstrip("_")
        result["pct"][source_id] = reserve(f"soc_{base}_pct", source_id)
    for source_id in metadata.get("secondary_absolute_values", []):
        result["absolute"][source_id] = reserve(f"soc_{ascii_slug(source_id)}_n", source_id)

    denominators = []
    for indicator in metadata.get("indicators", []):
        denominator = indicator.get("denominador")
        if denominator and denominator not in denominators:
            denominators.append(denominator)
    for source_id in denominators:
        result["universe"][source_id] = reserve(f"soc_{ascii_slug(source_id)}_tot", source_id)
    return result


def percent(numerator: Any, denominator: Any) -> float | None:
    if numerator is None or denominator is None or denominator == 0:
        return None
    return round((numerator / denominator) * 100, 4)


def electoral_values(row: dict[str, Any] | None) -> tuple[float | None, float | None]:
    if not row:
        return None, None
    peronist_votes = (row.get("bloques") or {}).get("PERONISMO_K")
    peronism = percent(peronist_votes, row.get("positivos"))
    electors = row.get("electores")
    voters = row.get("votantes")
    absenteeism = percent(electors - voters, electors) if electors is not None and voters is not None else None
    return peronism, absenteeism


def continuity(rows: list[dict[str, Any] | None]) -> tuple[str, dict[str, int]]:
    """Replica continuityResultMap de js/app.js para PERONISMO_K."""
    wins = losses = ties = missing = 0
    for row in rows:
        if not row or not row.get("positivos"):
            missing += 1
            continue
        winner_votes = row.get("ganador_votos") or 0
        runner_votes = row.get("segundo_votos") or 0
        selected_votes = (row.get("bloques") or {}).get("PERONISMO_K") or 0
        if winner_votes > 0 and winner_votes == runner_votes and selected_votes == winner_votes:
            ties += 1
        elif selected_votes > 0 and selected_votes == winner_votes and winner_votes > runner_votes:
            wins += 1
        else:
            losses += 1
    if missing:
        category = "incomplete"
    elif ties:
        category = "tie"
    elif wins == len(rows):
        category = "always_win"
    elif losses == len(rows):
        category = "always_lose"
    else:
        category = "alternation"
    return CONTINUITY_LABELS[category], {
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "missing": missing,
    }


def standardized_territory_properties(
    level: str,
    props: dict[str, Any],
    socio: dict[str, Any] | None,
) -> dict[str, Any]:
    if level == "partido":
        territory_id = props.get("key") or props.get("cde")
        name = props.get("partido") or (socio or {}).get("partido")
        party_id = territory_id
        party_name = name
        locality_id = locality_name = circuit_id = None
    elif level == "localidad":
        territory_id = props.get("localidad_key") or props.get("clc") or props.get("key")
        name = props.get("localidad") or (socio or {}).get("localidad")
        party_id = props.get("partido_norm") or props.get("cde") or (socio or {}).get("partido_id")
        party_name = props.get("partido") or (socio or {}).get("partido")
        locality_id = territory_id
        locality_name = name
        circuit_id = None
    else:
        territory_id = props.get("key") or props.get("circuito")
        name = props.get("circuito") or territory_id
        party_id = props.get("partido_norm") or props.get("cde") or (socio or {}).get("partido_id")
        party_name = props.get("partido") or (socio or {}).get("partido")
        locality_id = (
            props.get("localidad_key")
            or props.get("localidad_clc")
            or (socio or {}).get("localidad_principal_id")
        )
        locality_name = props.get("localidad") or (socio or {}).get("localidad_principal")
        circuit_id = territory_id
    return {
        "id": territory_id,
        "nombre": name,
        "tipo": level,
        "cod_partido": party_id,
        "nom_partido": party_name,
        "cod_local": locality_id,
        "nom_local": locality_name,
        "cod_circuito": circuit_id,
    }


def field_metadata_base(field: str, level: str) -> dict[str, Any]:
    definitions = {
        "id": ("Identificador territorial", "Identificador estable de la unidad territorial."),
        "nombre": ("Nombre", "Nombre de la unidad territorial."),
        "tipo": ("Tipo de unidad", "Nivel territorial de la feature."),
        "cod_partido": ("Código de partido", "Código INDEC del partido."),
        "nom_partido": ("Nombre de partido", "Nombre del partido correspondiente."),
        "cod_local": ("Código de localidad", "Código de localidad correspondiente, cuando existe."),
        "nom_local": ("Nombre de localidad", "Nombre de la localidad correspondiente, cuando existe."),
        "cod_circuito": ("Código de circuito", "Código del circuito electoral, cuando corresponde."),
        "continuidad": ("Continuidad", "Resultado del peronismo en las ocho elecciones: siempre gana, siempre pierde, alternancia, empate o datos incompletos."),
    }
    label, description = definitions.get(field, (field, f"Atributo territorial original de la capa de {level}."))
    return {
        "campo": field,
        "tipo": "continuidad" if field == "continuidad" else "territorial",
        "nombre_visible": label,
        "descripcion": description,
        "eleccion": None,
        "dimension": "Continuidad electoral" if field == "continuidad" else "Territorio",
        "categoria": None,
        "unidad": "categoria" if field == "continuidad" else None,
        "universo": None,
        "anio": None,
        "fuente": "js/app.js" if field == "continuidad" else "GeoJSON territorial del proyecto",
        "niveles": [level],
    }


def socioeconomic_metadata(
    source_metadata: dict[str, Any],
    field_map: dict[str, dict[str, str]],
    level: str,
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    indicators = {item["id"]: item for item in source_metadata.get("indicators", [])}
    for source_id, field in field_map["pct"].items():
        item = indicators[source_id]
        result[field] = {
            "campo": field,
            "tipo": "socioeconomico",
            "nombre_visible": item.get("nombre") or source_id,
            "descripcion": item.get("descripcion"),
            "eleccion": None,
            "dimension": item.get("grupo_tematico"),
            "categoria": item.get("nombre"),
            "unidad": "porcentaje",
            "universo": item.get("universo"),
            "anio": item.get("anio"),
            "fuente": item.get("fuente"),
            "codigo_fuente": source_id,
            "denominador_fuente": item.get("denominador"),
            "niveles": [level],
        }
    for source_id, field in field_map["absolute"].items():
        result[field] = {
            "campo": field,
            "tipo": "socioeconomico",
            "nombre_visible": source_id.replace("_", " ").capitalize(),
            "descripcion": f"Valor absoluto auditado: {source_id}.",
            "eleccion": None,
            "dimension": "Población",
            "categoria": None,
            "unidad": "cantidad",
            "universo": "Población",
            "anio": 2022,
            "fuente": "INDEC · Censo Nacional de Población, Hogares y Viviendas 2022",
            "codigo_fuente": source_id,
            "niveles": [level],
        }
    denominators: dict[str, dict[str, Any]] = {}
    for item in indicators.values():
        denominator = item.get("denominador")
        if denominator and denominator not in denominators:
            denominators[denominator] = item
    for source_id, field in field_map["universe"].items():
        item = denominators[source_id]
        result[field] = {
            "campo": field,
            "tipo": "socioeconomico_denominador",
            "nombre_visible": f"Total: {item.get('universo') or source_id}",
            "descripcion": f"Denominador auditado {source_id}, útil para interpretar los porcentajes asociados.",
            "eleccion": None,
            "dimension": item.get("grupo_tematico"),
            "categoria": None,
            "unidad": "cantidad",
            "universo": item.get("universo"),
            "anio": item.get("anio"),
            "fuente": item.get("fuente"),
            "codigo_fuente": source_id,
            "niveles": [level],
        }
    return result


def electoral_metadata(
    sources: list[dict[str, Any]],
    election_fields: dict[str, dict[str, str]],
    level: str,
) -> dict[str, dict[str, Any]]:
    result = {}
    for source in sources:
        fields = election_fields[source["id"]]
        common = {
            "eleccion": source.get("label"),
            "dimension": "Resultados electorales",
            "categoria": None,
            "anio": int(source["year"]) if str(source.get("year", "")).isdigit() else source.get("year"),
            "fuente": "data/electoral_data.json",
            "eleccion_id": source["id"],
            "niveles": [level],
        }
        result[fields["per"]] = {
            "campo": fields["per"],
            "tipo": "electoral",
            "nombre_visible": "% de voto peronista",
            "descripcion": "Votos del bloque PERONISMO_K sobre votos positivos, multiplicado por 100.",
            "unidad": "porcentaje",
            "universo": "Votos positivos",
            **common,
        }
        result[fields["aus"]] = {
            "campo": fields["aus"],
            "tipo": "electoral",
            "nombre_visible": "% de ausentismo",
            "descripcion": "Electores que no votaron sobre electores habilitados, multiplicado por 100.",
            "unidad": "porcentaje",
            "universo": "Electores habilitados",
            **common,
        }
    return result


def compare_value(actual: Any, expected: Any, tolerance: float = 0.0) -> bool:
    if actual is None or expected is None:
        return actual is expected
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return abs(actual - expected) <= tolerance
    return actual == expected


def sample_keys(keys: list[str], count: int = 3) -> list[str]:
    if len(keys) <= count:
        return keys
    positions = [0, len(keys) // 2, len(keys) - 1]
    return [keys[position] for position in positions]


def build_level(
    level: str,
    config: dict[str, str],
    data_dir: Path,
    output_dir: Path,
    electoral: dict[str, Any],
    sources: list[dict[str, Any]],
    election_fields: dict[str, dict[str, str]],
) -> tuple[dict[str, Any], dict[str, dict[str, Any]], dict[str, Any]]:
    geometry_path = data_dir / config["geometry"]
    socio_path = data_dir / config["socio"]
    geometry = load_json(geometry_path)
    socio_doc = load_json(socio_path)
    socio_rows = {str(row["territorio_id"]): row for row in socio_doc.get("territories", [])}
    if len(socio_rows) != len(socio_doc.get("territories", [])):
        raise ValueError(f"{socio_path}: territorio_id duplicado")
    field_map = socioeconomic_fields(socio_doc["metadata"])
    elections = electoral[config["electoral_key"]]["elections"]

    generated_fields = [
        *(item["per"] for item in election_fields.values()),
        *(item["aus"] for item in election_fields.values()),
        "continuidad",
        *field_map["pct"].values(),
        *field_map["absolute"].values(),
        *field_map["universe"].values(),
    ]
    feature_ids: list[str] = []
    output_features = []
    sample_checks: list[dict[str, Any]] = []

    for feature in geometry.get("features", []):
        original_props = feature.get("properties") or {}
        territory_id = original_props.get(config["feature_key"])
        if territory_id is None:
            raise ValueError(f"Feature de {level} sin clave {config['feature_key']}")
        territory_id = str(territory_id)
        feature_ids.append(territory_id)
        socio = socio_rows.get(territory_id)
        props = copy.deepcopy(original_props)
        props.update(standardized_territory_properties(level, props, socio))
        for field in generated_fields:
            props[field] = None

        election_rows = []
        for source in sources:
            row = elections.get(source["id"], {}).get(territory_id)
            election_rows.append(row)
            peronism, absenteeism = electoral_values(row)
            props[election_fields[source["id"]]["per"]] = peronism
            props[election_fields[source["id"]]["aus"]] = absenteeism
        props["continuidad"], _ = continuity(election_rows)

        if socio:
            for source_id, field in field_map["pct"].items():
                props[field] = (socio.get("indicadores_pct") or {}).get(source_id)
            for source_id, field in field_map["absolute"].items():
                props[field] = (socio.get("valores_absolutos") or {}).get(source_id)
            for source_id, field in field_map["universe"].items():
                props[field] = (socio.get("universos") or {}).get(source_id)
        output_features.append({**feature, "properties": props})

    duplicate_ids = sorted(key for key, count in Counter(feature_ids).items() if count > 1)
    if duplicate_ids:
        raise ValueError(f"IDs de geometria duplicados en {level}: {duplicate_ids[:10]}")
    feature_id_set = set(feature_ids)
    socioeconomic_without_geometry = sorted(set(socio_rows) - feature_id_set)
    geometry_without_socioeconomic = sorted(feature_id_set - set(socio_rows))
    electoral_ids = set().union(*(set(elections.get(source["id"], {})) for source in sources))
    geometry_without_electoral = sorted(feature_id_set - electoral_ids)
    electoral_without_geometry = sorted(electoral_ids - feature_id_set)
    partial_electoral = sorted(
        territory_id
        for territory_id in feature_id_set
        if 0 < sum(territory_id in elections.get(source["id"], {}) for source in sources) < len(sources)
    )

    by_id = {feature["properties"]["id"]: feature["properties"] for feature in output_features}
    matched_samples = sample_keys(sorted(feature_id_set & set(socio_rows) & electoral_ids))
    for territory_id in matched_samples:
        props = by_id[territory_id]
        socio = socio_rows[territory_id]
        socio_ok = all(
            compare_value(props[field], (socio.get("indicadores_pct") or {}).get(source_id))
            for source_id, field in field_map["pct"].items()
        ) and all(
            compare_value(props[field], (socio.get("valores_absolutos") or {}).get(source_id))
            for source_id, field in field_map["absolute"].items()
        ) and all(
            compare_value(props[field], (socio.get("universos") or {}).get(source_id))
            for source_id, field in field_map["universe"].items()
        )
        electoral_ok = True
        rows = []
        for source in sources:
            row = elections.get(source["id"], {}).get(territory_id)
            rows.append(row)
            peronism, absenteeism = electoral_values(row)
            electoral_ok &= compare_value(props[election_fields[source["id"]]["per"]], peronism)
            electoral_ok &= compare_value(props[election_fields[source["id"]]["aus"]], absenteeism)
        expected_continuity, _ = continuity(rows)
        electoral_ok &= props["continuidad"] == expected_continuity
        sample_checks.append({
            "id": territory_id,
            "socioeconomico_exacto": bool(socio_ok),
            "electoral_exacto": bool(electoral_ok),
            "continuidad": props["continuidad"],
        })
    if not all(item["socioeconomico_exacto"] and item["electoral_exacto"] for item in sample_checks):
        raise ValueError(f"Fallo la comparacion muestral de {level}: {sample_checks}")

    output = copy.deepcopy(geometry)
    output["name"] = Path(config["output"]).stem
    output["features"] = output_features
    output_path = output_dir / config["output"]
    write_json(output_path, output)

    fields: dict[str, dict[str, Any]] = {}
    all_property_fields = sorted(set().union(*(feature["properties"].keys() for feature in output_features)))
    for field in all_property_fields:
        fields[field] = field_metadata_base(field, level)
    fields.update(electoral_metadata(sources, election_fields, level))
    fields.update(socioeconomic_metadata(socio_doc["metadata"], field_map, level))

    controls = {
        "archivo": str(output_path.relative_to(ROOT)).replace("\\", "/"),
        "features": len(output_features),
        "ids_unicos": len(feature_id_set),
        "ids_duplicados": duplicate_ids,
        "socioeconomicos_sin_geometria": socioeconomic_without_geometry,
        "geometrias_sin_socioeconomicos": geometry_without_socioeconomic,
        "geometrias_sin_datos_electorales": geometry_without_electoral,
        "electorales_sin_geometria": electoral_without_geometry,
        "geometrias_con_datos_electorales_parciales": partial_electoral,
        "muestra_comparada": sample_checks,
        "indicadores_socioeconomicos_pct": len(field_map["pct"]),
        "valores_socioeconomicos_absolutos": len(field_map["absolute"]),
        "denominadores_socioeconomicos": len(field_map["universe"]),
        "fuente_geometria": str(geometry_path.relative_to(ROOT)).replace("\\", "/"),
        "fuente_socioeconomica": str(socio_path.relative_to(ROOT)).replace("\\", "/"),
    }
    return output, fields, controls


def merge_field_metadata(target: dict[str, dict[str, Any]], incoming: dict[str, dict[str, Any]]) -> None:
    for field, metadata in incoming.items():
        if field not in target:
            target[field] = metadata
            continue
        levels = list(dict.fromkeys([*target[field].get("niveles", []), *metadata.get("niveles", [])]))
        target[field]["niveles"] = levels


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_dir = args.data_dir.resolve()
    output_dir = args.output_dir.resolve()
    electoral_path = data_dir / "electoral_data.json"
    electoral = load_json(electoral_path)
    sources = electoral.get("sources", [])
    if len(sources) != 8:
        raise ValueError(f"Se esperaban 8 elecciones consolidadas y se encontraron {len(sources)}")
    election_fields = build_election_fields(sources)

    all_fields: dict[str, dict[str, Any]] = {}
    controls: dict[str, Any] = {}
    for level, config in LEVELS.items():
        _, fields, level_controls = build_level(
            level, config, data_dir, output_dir, electoral, sources, election_fields
        )
        merge_field_metadata(all_fields, fields)
        controls[level] = level_controls

    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    metadata = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "descripcion": "Diccionario y trazabilidad de los GeoJSON analiticos derivados del Atlas Electoral PBA.",
        "fuentes": {
            "electoral": "data/electoral_data.json",
            "socioeconomicas": [f"data/{config['socio']}" for config in LEVELS.values()],
            "geometrias": [f"data/{config['geometry']}" for config in LEVELS.values()],
        },
        "elecciones": [
            {
                "id": source["id"],
                "nombre": source.get("label"),
                "anio": source.get("year"),
                "tipo": source.get("election_type"),
                "cargo": source.get("cargo"),
                "sufijo_campos": election_fields[source["id"]]["suffix"],
            }
            for source in sources
        ],
        "convencion_nombres": {
            "electoral": "per_AA_tipo_cargo y aus_AA_tipo_cargo; porcentajes en escala 0-100 con 4 decimales.",
            "socioeconomico_relativo": "soc_codigo_fuente_pct; valor copiado exactamente del JSON auditado.",
            "socioeconomico_absoluto": "soc_codigo_fuente_n.",
            "socioeconomico_denominador": "soc_codigo_fuente_tot.",
            "nulos": "null se preserva; nunca se reemplaza por cero.",
        },
        "continuidad": {
            "campo": "continuidad",
            "fuerza": "PERONISMO_K",
            "elecciones": len(sources),
            "categorias": list(CONTINUITY_LABELS.values()),
            "regla": "Replica js/app.js: faltantes tienen prioridad; luego empates; victoria y derrota se deciden con votos absolutos no redondeados.",
        },
        "campos": dict(sorted(all_fields.items())),
        "controles": controls,
    }
    metadata_path = output_dir / "geojson_indicadores_metadata.json"
    write_json(metadata_path, metadata)

    print(f"Generados {len(LEVELS)} GeoJSON y {metadata_path.relative_to(ROOT)}")
    print("Elecciones:")
    for source in sources:
        suffix = election_fields[source["id"]]["suffix"]
        print(f"  - {suffix}: {source['label']}")
    print("Controles:")
    for level, item in controls.items():
        print(
            f"  - {level}: {item['features']} features; "
            f"sin electoral={len(item['geometrias_sin_datos_electorales'])}; "
            f"sin socioeconomico={len(item['geometrias_sin_socioeconomicos'])}; "
            f"parciales electorales={len(item['geometrias_con_datos_electorales_parciales'])}; "
            f"socio={item['indicadores_socioeconomicos_pct']} pct + "
            f"{item['valores_socioeconomicos_absolutos']} n + "
            f"{item['denominadores_socioeconomicos']} tot"
        )


if __name__ == "__main__":
    main()
