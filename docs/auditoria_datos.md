# Auditoria de datos electorales PBA

Generado: 2026-08-10T22:50:26

## Alcance vigente

- Esta auditoria corresponde a la app `05_MapaElectoral_Cockpit_CSV`.
- Capa de partidos fuente: `02_PartidosPBA2.geojson`.
- Capa de circuitos fuente: `01_CircuitosElectorales2025_PBA3.geojson`.
- La clave de union de partido es `CODIGO`.
- La clave de union de circuito es `circuito`, normalizada sin ceros iniciales y conservando sufijos alfabeticos.
- Los artefactos auditados son `electoral_data.json`, `partidos_pba.geojson`, `localidades_pba_mas2000.geojson` y `circuitos_pba.geojson` dentro de `data/`.

## Inventario CSV DINE

| eleccion | archivo | filas | circuitos | mesas | electores | votos | positivos | duplicados | claves_nulas | cierre_positivos | participacion_est |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2019 · General · Diputados nacionales | 01_DINE\00_2019\presentacionDeResultados Generales Diputados Nacionales (2019).csv | 314.001 | 1121 | 34.889 | 11.995.955 | 9.881.630 | 9.259.477 | 0 | 0 | 0 | 82.37% |
| 2019 · General · Gobernador | 01_DINE\00_2019\presentacionDeResultados Generales Gobernador (2019).csv | 357.164 | 1122 | 36.071 | 12.597.917 | 10.075.030 | 9.605.206 | 0 | 0 | 0 | 79.97% |
| 2019 · General · Presidente | 01_DINE\00_2019\presentacionDeResultados Generales Presidente (2019).csv | 383.779 | 1121 | 34.889 | 11.995.955 | 9.882.295 | 9.653.058 | 0 | 0 | 0 | 82.38% |
| 2021 · General · Diputados nacionales | 01_DINE\00_2021\presentacionDeResultados Generales Diputados 2021.csv | 398.695 | 1112 | 36.245 | 12.530.612 | 9.133.379 | 8.741.842 | 0 | 0 | 0 | 72.89% |
| 2023 · General · Presidente/a | 01_DINE\01_2023\01_ResultadosGeneralesPresidencialesPBA2023.csv | 380.740 | 1047 | 38.074 | 13.124.435 | 10.199.399 | 9.852.591 | 0 | 0 | 0 | 77.71% |
| 2023 · Segunda vuelta · Presidente y vice | 01_DINE\01_2023\02_ResultadosSegundaPresidencialesPBA2023.csv | 226.998 | 1039 | 37.833 | 13.052.907 | 10.017.387 | 9.695.922 | 0 | 0 | 0 | 76.74% |
| 2023 · General · Gobernador/a | 01_DINE\01_2023\03_ResultadosGeneralesGobernadorPBA2023.csv | 361.809 | 1047 | 40.201 | 14.073.604 | 10.439.895 | 9.429.942 | 0 | 0 | 0 | 74.18% |
| 2025 · Generales · Diputado nacional | 01_DINE\02_2025\01_ResultadosDiputadosGeneralesPBA2025.csv | 775.200 | 1047 | 38.760 | 13.349.014 | 9.013.159 | 8.696.636 | 0 | 0 | 0 | 67.52% |

Nota: `participacion_est` se calcula como suma de votos registrados / electores unicos por mesa.

## Capas fuente

- Partidos fuente: 135 features, 135 CODIGO unicos.
- Circuitos fuente: 1153 features, 1153 circuitos unicos.
- CODIGO de partido presentes en circuitos fuente: 135.
- Features de circuito sin `CODIGO`: 0.
- Features de circuito sin `circuito`: 0.
- CODIGO duplicados en partidos fuente: ninguno.

Partidos criticos en la capa fuente:

| codigo | esperado | nombre_fuente |
| --- | --- | --- |
| 06218 | Chascomús | Chascomús |
| 06466 | Lezama | Lezama |
| 06371 | General San Martín | General San Martín |

## Cobertura circuito contra capa PBA3

| eleccion | circuitos_dine | match | cobertura_dine | dine_sin_geo | geo_sin_datos |
| --- | --- | --- | --- | --- | --- |
| 2019 · General · Diputados nacionales | 1121 | 1118 | 99.73% | 3 | 35 |
| 2019 · General · Gobernador | 1122 | 1118 | 99.64% | 4 | 35 |
| 2019 · General · Presidente | 1121 | 1118 | 99.73% | 3 | 35 |
| 2021 · General · Diputados nacionales | 1112 | 1109 | 99.73% | 3 | 44 |
| 2023 · General · Presidente/a | 1047 | 1045 | 99.81% | 2 | 108 |
| 2023 · Segunda vuelta · Presidente y vice | 1039 | 1037 | 99.81% | 2 | 116 |
| 2023 · General · Gobernador/a | 1047 | 1045 | 99.81% | 2 | 108 |
| 2025 · Generales · Diputado nacional | 1047 | 1047 | 100.0% | 0 | 106 |

Muestras de circuitos DINE sin geometria:

- 2019 · General · Diputados nacionales: ['383', '388', '961C']
- 2019 · General · Gobernador: ['383', '388', '933', '961C']
- 2019 · General · Presidente: ['383', '388', '961C']
- 2021 · General · Diputados nacionales: ['383', '388', '961C']
- 2023 · General · Presidente/a: ['383', '388']
- 2023 · Segunda vuelta · Presidente y vice: ['383', '388']
- 2023 · General · Gobernador/a: ['383', '388']
- 2025 · Generales · Diputado nacional: ninguno

## Auditoria de localidades

- Circuitos en la correspondencia: 1153.
- Circuitos con localidad: 680.
- Circuitos sin localidad: 473.
- Pares partido-localidad: 206.
- Capa oficial de localidades: 219 features y 219 CLC unicos.
- Localidades con resultados electorales asignados: 206; sin circuito principal: 13.
- Relaciones secundarias circuito-localidad conservadas: 18.
- La cartografia de localidad usa los poligonos oficiales de localidades censales de mas de 2.000 habitantes.

| eleccion | localidades | circuitos_vinculados | cobertura_electores | cierre_electores | cierre_votos | claves_partido_invalidas |
| --- | --- | --- | --- | --- | --- | --- |
| 2019 · General · Diputados nacionales | 206 | 653 | 97.70% | 0 | 0 | 0 |
| 2019 · General · Gobernador | 206 | 653 | 97.79% | 0 | 0 | 0 |
| 2019 · General · Presidente | 206 | 653 | 97.70% | 0 | 0 | 0 |
| 2021 · General · Diputados nacionales | 206 | 667 | 97.75% | 0 | 0 | 0 |
| 2023 · General · Presidente/a | 205 | 666 | 97.74% | 0 | 0 | 0 |
| 2023 · Segunda vuelta · Presidente y vice | 205 | 665 | 97.75% | 0 | 0 | 0 |
| 2023 · General · Gobernador/a | 205 | 666 | 97.87% | 0 | 0 | 0 |
| 2025 · Generales · Diputado nacional | 205 | 668 | 98.41% | 0 | 0 | 0 |

## Artefactos normalizados de la app

- `electoral_data.json` generado: 2026-08-10T22:38:09.
- Elecciones procesadas: 8.
- GeoJSON partidos app: 135 features, 135 claves unicas.
- GeoJSON circuitos app: 1153 features, 1153 claves unicas.
- GeoJSON localidades app: 219 features, 219 claves unicas.

| eleccion | partidos | circuitos_datos | partidos_sin_geo | circuitos_sin_geo | cierre_votos | cierre_electores | cierre_positivos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2019 · General · Diputados nacionales | 135 | 1121 | 0 | 3 | 0 | 0 | 0 |
| 2019 · General · Gobernador | 135 | 1122 | 0 | 4 | 0 | 0 | 0 |
| 2019 · General · Presidente | 135 | 1121 | 0 | 3 | 0 | 0 | 0 |
| 2021 · General · Diputados nacionales | 135 | 1112 | 0 | 3 | 0 | 0 | 0 |
| 2023 · General · Presidente/a | 135 | 1047 | 0 | 2 | 0 | 0 | 0 |
| 2023 · Segunda vuelta · Presidente y vice | 135 | 1039 | 0 | 2 | 0 | 0 | 0 |
| 2023 · General · Gobernador/a | 135 | 1047 | 0 | 2 | 0 | 0 | 0 |
| 2025 · Generales · Diputado nacional | 135 | 1047 | 0 | 0 | 0 | 0 | 0 |

## Validacion de partidos criticos en datos agregados

| eleccion | codigo | esperado | nombre | circuitos | electores | votantes |
| --- | --- | --- | --- | --- | --- | --- |
| 2019 · General · Diputados nacionales | 06218 | Chascomús | Chascomús | 9 | 32.534 | 26.974 |
| 2019 · General · Diputados nacionales | 06466 | Lezama | Lezama | 1 | 4.813 | 4.239 |
| 2019 · General · Diputados nacionales | 06371 | General San Martín | General San Martín | 11 | 317.002 | 256.704 |
| 2019 · General · Gobernador | 06218 | Chascomús | Chascomús | 9 | 32.931 | 27.135 |
| 2019 · General · Gobernador | 06466 | Lezama | Lezama | 1 | 4.883 | 4.297 |
| 2019 · General · Gobernador | 06371 | General San Martín | General San Martín | 11 | 341.461 | 263.127 |
| 2019 · General · Presidente | 06218 | Chascomús | Chascomús | 9 | 32.534 | 27.057 |
| 2019 · General · Presidente | 06466 | Lezama | Lezama | 1 | 4.813 | 4.250 |
| 2019 · General · Presidente | 06371 | General San Martín | General San Martín | 11 | 317.002 | 256.591 |
| 2021 · General · Diputados nacionales | 06218 | Chascomús | Chascomús | 8 | 33.651 | 24.348 |
| 2021 · General · Diputados nacionales | 06466 | Lezama | Lezama | 1 | 4.556 | 3.586 |
| 2021 · General · Diputados nacionales | 06371 | General San Martín | General San Martín | 11 | 322.661 | 234.197 |
| 2023 · General · Presidente/a | 06218 | Chascomús | Chascomús | 6 | 35.319 | 27.578 |
| 2023 · General · Presidente/a | 06466 | Lezama | Lezama | 1 | 4.965 | 4.148 |
| 2023 · General · Presidente/a | 06371 | General San Martín | General San Martín | 11 | 351.839 | 265.803 |
| 2023 · Segunda vuelta · Presidente y vice | 06218 | Chascomús | Chascomús | 6 | 35.366 | 26.756 |
| 2023 · Segunda vuelta · Presidente y vice | 06466 | Lezama | Lezama | 1 | 4.968 | 3.862 |
| 2023 · Segunda vuelta · Presidente y vice | 06371 | General San Martín | General San Martín | 11 | 350.871 | 265.179 |
| 2023 · General · Gobernador/a | 06218 | Chascomús | Chascomús | 6 | 35.936 | 27.737 |
| 2023 · General · Gobernador/a | 06466 | Lezama | Lezama | 1 | 5.060 | 4.173 |
| 2023 · General · Gobernador/a | 06371 | General San Martín | General San Martín | 11 | 397.173 | 273.079 |
| 2025 · Generales · Diputado nacional | 06218 | Chascomús | Chascomús | 6 | 35.945 | 23.816 |
| 2025 · Generales · Diputado nacional | 06466 | Lezama | Lezama | 1 | 5.022 | 3.467 |
| 2025 · Generales · Diputado nacional | 06371 | General San Martín | General San Martín | 12 | 378.078 | 242.835 |

## Lectura operativa

- A nivel partido, todas las elecciones quedan con 135 partidos y sin partidos con datos fuera de la geometria.
- Chascomus y Lezama quedan separados por CODIGO: `06218` y `06466`.
- General San Martin queda agregado por CODIGO `06371`, incluyendo circuitos historicos 2023 aunque no existan como poligonos individuales en la capa 2025.
- En vista circuito, 2023 conserva una salvedad: los circuitos historicos `383` y `388` no tienen geometria propia en PBA3.
