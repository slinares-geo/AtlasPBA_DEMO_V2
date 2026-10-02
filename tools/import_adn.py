"""Validate and package the approved precomputed index. Does not recalculate scores."""
import argparse
import hashlib
import json
import math
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(r'G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos\04_Socioeconomicos\ADN\v1_experimental_20261002')
FILES = {'party':'adn_partidos.json','locality':'adn_localidades.json','circuit':'adn_circuitos.json'}
GEOMETRIES = {'party':('partidos_pba.geojson','key'), 'locality':('localidades_pba_mas2000.geojson','localidad_key'), 'circuit':('circuitos_pba.geojson','key')}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def build(source, app=APP):
    parameters = read(source / 'parametros_adn.json')
    require(read(source / 'auditoria_adn.json')['validacion'] == 'OK', 'Source audit not approved')
    # Electoral data may gain elections. Censal inputs and geometry must still match.
    for filename, expected in parameters['fuentes_sha256'].items():
        name = Path(filename).name
        if name in ['socioeconomic_data.json'] + [v[0] for v in GEOMETRIES.values()]:
            require(sha(app / 'data' / name) == expected, f'Source drift: {name}; review a new index version')
    electoral = read(app / 'data/electoral_data.json')
    territories, audit, scores = {}, {}, []
    for unit, name in FILES.items():
        data = read(source / name)
        meta, rows = data['metadata'], data['territories']
        require(meta['nivel_app'] == unit and meta['primary_key'] == 'territorio_id', f'Unexpected PK: {name}')
        require(meta['version_indice'] == parameters['version_indice'] and meta['referencia_id'] == parameters['referencia_id'], f'Mixed version: {name}')
        require(len(rows) == meta['rows'], f'Row count mismatch: {name}')
        require(all(isinstance(row['territorio_id'], str) and row['territorio_id'] for row in rows), 'Territory keys must be nonempty strings')
        by_key = {row['territorio_id']:row for row in rows}
        require(len(by_key) == len(rows), f'Duplicate PK: {name}')
        for row in rows:
            require(row['nivel_app'] == unit and row['version_indice'] == meta['version_indice'] and row['referencia_id'] == meta['referencia_id'], 'Row contract mismatch')
            value = row['adn']
            if value is None:
                require(row['estado'] != 'calculado' and bool(row['motivo_sin_dato']), 'Missing null explanation')
            else:
                require(type(value) in (int,float) and math.isfinite(value) and row['estado'] == 'calculado', 'Invalid score')
                contributions = [v for k,v in row.items() if k.endswith('_aporte')]
                require(len(contributions) == 10 and abs(sum(contributions)-value) <= 1e-11, 'Score differs from stored contributions')
                scores.append(value)
        geo, key = GEOMETRIES[unit]
        geometry_keys = {f['properties'][key] for f in read(app / 'data' / geo)['features']}
        require(geometry_keys <= by_key.keys(), f'Geometry keys absent: {unit}')
        joins = {}
        for election, election_rows in electoral[unit]['elections'].items():
            missing = set(election_rows)-by_key.keys()
            require(not missing, f'Unmapped {unit}/{election}: {sorted(missing)}')
            joins[election] = len(election_rows)
        territories[unit] = by_key
        audit[unit] = {'rows':len(rows), 'calculated':sum(r['adn'] is not None for r in rows),
                       'null_keys':[r['territorio_id'] for r in rows if r['adn'] is None],
                       'geometry_matches':len(geometry_keys), 'electoral_joins':joins, 'duplicate_keys':0}
    for unit, rows in territories.items():
        require(all(r['partido_id'] in territories['party'] for r in rows.values()), f'Party FK mismatch: {unit}')
    hashes = {name:sha(source/name) for name in [*FILES.values(),'parametros_adn.json','auditoria_adn.json']}
    return {'schema_version':1, 'metadata':{
        'id':'adn', 'version_indice':parameters['version_indice'], 'referencia_id':parameters['referencia_id'],
        'anio_censal':parameters['anio_censal'], 'primary_key':['nivel_app','territorio_id'],
        'display_domain':[min(scores),max(scores)], 'source_sha256':hashes,
        'parameters':parameters, 'validation':audit}, 'territories':territories}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=DEFAULT_SOURCE)
    args = parser.parse_args()
    result = build(args.source)
    target = APP / 'data/adn.json'
    temporary = target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    temporary.replace(target)
    print(json.dumps(result['metadata']['validation'],ensure_ascii=False,indent=2))
