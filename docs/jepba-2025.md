# Provinciales PBA 2025: escrutinio definitivo

## Fuente y alcance

Eleccion general provincial del **7 de septiembre de 2025**, escrutinio definitivo de la **Junta Electoral de la Provincia de Buenos Aires**. Descarga: **2 de octubre de 2026**, con hora UTC individual en el manifiesto.

- Distritos: `https://www.juntaelectoral.gba.gov.ar/escrutinio-definitivo-2025/distrito_001.html` a `distrito_135.html`.
- Secciones: `https://www.juntaelectoral.gba.gov.ar/escrutinio-definitivo-2025/seccion_1.html` a `seccion_8.html`.
- Calendario oficial: https://www.juntaelectoral.gba.gov.ar/docs/planillas_elecciones_provinciales_2025.pdf
- Nivel minimo incorporado: **partido/distrito**, nunca circuito, localidad, establecimiento ni mesa.

## Evaluacion y arquitectura adoptada

Atlas es una aplicacion estatica: no hay API de resultados ni base transaccional. El loader del navegador consume `data/electoral_data.json`, con catalogo `sources` y diccionarios de resultados por eleccion y territorio para `party`, `locality` y `circuit`. Las elecciones anteriores se agregan desde circuitos mediante `tools/build_data.py`.

Se reutilizan ese catalogo, los resultados por partido, las geometrías existentes, las agrupaciones politicas y los renderizadores. No se crea una arquitectura paralela ni una tabla de circuitos ficticios. `data/jepba_2025.json` es un suplemento validado y regenerable, que `build_data.py` tambien incorpora al reconstruir el dataset general.

La nueva fuente declara `available_levels: ["party"]`, `minimum_level: "party"` y las metricas efectivamente disponibles. Los diccionarios de circuito/localidad quedan vacios **por contrato**, no por error o cobertura incompleta. Los datos originales de las ocho elecciones anteriores y sus defaults quedan intactos.

Identificador Atlas: `2025_generales_legislatura_provincial_jepba_definitivo`.

## Almacenamiento

| Formato | Decision y motivos |
| --- | --- |
| HTML original | Raw elegido. Evidencia exacta de tablas, encabezados y contexto oficial; reproducible con URL, fecha, bytes y SHA256. Mas voluminoso y sin tipos, pero imprescindible para auditar el parser. |
| JSON normalizado | Capa de procesamiento elegida. Tipos numericos y null explicitos, claves de texto, dimensiones, categorias, subtotales y procedencia. Facil de inspeccionar y coherente con Atlas. Version de esquema explicita. |
| CSV | Util para intercambio tabular, pero no preserva tipos ni metadatos relacionados sin varios archivos y convenciones adicionales. No se usa como evidencia ni como intermediario de esta integracion. El visor conserva su exportacion CSV filtrada. |
| Parquet | Buen tipado y compresion para analitica masiva; innecesario para 4274 filas y una app que consume JSON. Agregaria dependencias y conversiones sin ventaja suficiente. |

Directorio de snapshot utilizado:

```text
G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos\05_JuntaElectoralPBA\2025\20261002
  raw/                      144 HTML: indice + 135 distritos + 8 secciones
  raw/manifest.json         URL, descarga UTC, SHA256, bytes, HTTP, errores
  normalized/parsing_audit.json
  normalized/validation.json
  normalized/stage_status.json
  normalized/jepba_2025_normalized.json
  load_audit/electoral_data_before.json
  load_audit/validation.json
```

Los HTML se conservan fuera del repositorio web. El normalizado incluye `territories`, `sections`, `summaries`, `results` y `validation`. `results` preserva los literales oficiales de votos y porcentajes; el HTML preserva tambien su presentacion exacta. Los JSON publicados en `data/` no dependen del acceso a G: al navegar.

## Grano y claves

- Grano normalizado: **eleccion + partido + categoria + lista oficial**.
- Clave natural: `(eleccion_id, partido_id, categoria, lista_codigo)`.
- PK tecnica `resultado_id`: concatenacion determinista de esos cuatro componentes con `|`; no es un numero de fila.
- Ejemplo: `PBA2025|06007|diputados_provinciales|2200` (estructura ilustrativa de clave).
- `partido_id` es la clave territorial Atlas/INDEC de cinco caracteres, preservando el cero inicial. Es la union con `partidos_pba.geojson.properties.key` y con `party.elections[id][partido_id]`.
- `distrito_junta_id` conserva los tres caracteres de la Junta y **no sustituye la clave territorial**.
- Resumen: `(eleccion_id, partido_id, categoria)`; dimension territorial: `partido_id`; seccion: `seccion_electoral_id`.
- Capa del visor: una fila por eleccion/partido, con fuerzas dentro de `fuerzas`. La categoria provincial de ese partido se conserva en la fila. Los Concejales nunca se suman con legisladores.

El mapping por nombre usa la normalizacion existente de Atlas y excepciones explicitas en `ALIASES`, sin fuzzy matching. Se exige una biyeccion exacta entre los 135 distritos y los 135 partidos. La relacion partido/seccion se obtiene de las dimensiones electorales ya existentes, verificando unicidad entre todas las elecciones. Se persiste en `territories`.

## Categorias y secciones

Los encabezados oficiales de las paginas determinan automaticamente las categorias. El cargo provincial de cada seccion se obtiene de su pagina oficial, se persiste en `sections` y se contrasta con cada distrito. No hay asignaciones de cargo repetidas en frontend y backend.

| Seccion | Cargo 2025 | Partidos |
| --- | --- | ---: |
| 1 | Senadores provinciales | 24 |
| 2 | Diputados provinciales | 15 |
| 3 | Diputados provinciales | 19 |
| 4 | Senadores provinciales | 19 |
| 5 | Senadores provinciales | 27 |
| 6 | Diputados provinciales | 22 |
| 7 | Senadores provinciales | 8 |
| 8 | Diputados provinciales | 1 |

La eleccion navegable es **Legislatura provincial**, combinando el cargo correspondiente a cada seccion. Su agregado provincial no representa un unico cargo identico en las ocho secciones ni una asignacion de bancas. Las comparaciones con elecciones nacionales describen variacion del voto entre elecciones distintas, no igualdad institucional de cargos.

## Semantica de los totales

En las 135 paginas, el total publicado cierra exactamente como **positivos + blancos**. No se publica desglose de nulos, recurridos o impugnados. No corresponde afirmar que ese total es el de sufragantes.

- Porcentaje oficial de agrupacion: votos / positivos, en escala 0 a 100 en el normalizado.
- Porcentaje oficial de positivos y blancos: respecto del total publicado.
- Porcentaje oficial de total: total publicado / electores.
- El visor usa proporciones 0 a 1, como las demas elecciones.
- `votantes`, `participacion`, `ausentismo`, `nulo`, `impugnado` y `recurrido`: **null**, no cero.
- `total_publicado` y `pct_blanco_total_publicado`: campos explicitos, sin reutilizar el denominador de votos emitidos de DINE.
- El guion oficial se preserva como null y con su literal original. No se declara voto cero; esas celdas no aportan a las sumas ni a las fuerzas del visor.

## Comportamiento del visor

`js/election-capabilities.mjs` resuelve la interseccion de niveles y metricas entre las fuentes activas. Las fuentes anteriores conservan sus capacidades por defecto.

Al seleccionar PBA 2025 se trabaja por partido, se cierran detalles de circuito y se limpian selecciones incompatibles. Los controles de circuito/localidad se ocultan. En comparaciones ambas elecciones usan el partido completo, aunque la otra tenga circuitos. Continuidad y cruces tambien respetan la interseccion de sus elecciones activas. Volver a una eleccion detallada habilita nuevamente sus niveles.

Disponibles: votos positivos por fuerza, brecha, competitividad y blancos sobre el total publicado en vista individual. Se deshabilitan participacion, ausentismo, tipos no publicados y porcentajes sobre sufragantes. Blancos con denominadores distintos no se comparan. Se muestra una nota de fuente, escrutinio, nivel y limitaciones, incluida en el informe.

El simulador, que requiere votantes y abstenciones, mantiene como base una eleccion que disponga de ese denominador. Esta fuente no reemplaza automaticamente su base nacional.

## Resultado y validaciones

- 135/135 distritos y 8/8 secciones descargados y procesados; cero errores.
- 4274 registros agrupacion/categoria, de los cuales 2935 contienen votos numericos y 1339 celdas oficiales son guiones.
- Diputados provinciales: 902 registros; Senadores provinciales: 1235; Concejales: 2137.
- 2137 registros legislativos normalizados alimentan 135 filas territoriales en Atlas. Los 2137 registros de Concejales se conservan separados en la capa normalizada, sin selector municipal en esta entrega.
- 270 resumenes distrito/categoria; cero claves naturales duplicadas.
- Porcentajes dentro de 0..100 y coherentes con numeradores/denominadores; tolerancia de 0.011 puntos porcentuales por redondeo publicado.
- Suma de agrupaciones = positivos; positivos + blancos = total; total <= electores.
- Mesas escrutadas <= totales; porcentaje coherente con ambas.
- 135 mappings univocos a partido y seccion; categoria consistente con la seccion.
- **Conciliacion exacta en las ocho secciones**, por lista, subtotales, electores y mesas: cero diferencias.
- Carga idempotente y preservacion comprobada de elecciones previas y defaults.
- Hash del normalizado, estado de normalizacion, manifiesto y raw comprobados antes de cargar. Una normalizacion interrumpida o fallida no habilita la carga de un archivo anterior.

La deteccion de tablas usa encabezados semanticos, no su posicion en la pagina; se acepta la omision de `<tr>` en los encabezados oficiales de seccion y se normaliza el subtotal `EN BLANCO`. Encabezados desconocidos, filas irregulares, identidades distintas, porcentajes inconsistentes o duplicados producen errores explicitos. Los controles matematicos asumen el esquema publicado actual; un cambio futuro debe revisarse, no ignorarse.

## Repetir el proceso

Desde la raiz del repositorio, Python 3 sin paquetes externos:

```powershell
python tools/import_jepba_2025.py download
python tools/import_jepba_2025.py normalize
python tools/import_jepba_2025.py load
```

Las tres etapas son independientes. `download` reanuda sin alterar HTML ya auditados, con tres intentos y tres conexiones concurrentes; registra errores en el manifiesto y falla si existen. Para descargar realmente **desde cero**, elegir un directorio de snapshot nuevo y usarlo en las tres etapas:

```powershell
$snapshot = 'G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos\05_JuntaElectoralPBA\2025\nuevo_snapshot'
python tools/import_jepba_2025.py download --root $snapshot
python tools/import_jepba_2025.py normalize --root $snapshot
python tools/import_jepba_2025.py load --root $snapshot
```

No borrar el snapshot original. Normalizar requiere las geometrías y los datos territoriales actuales de Atlas; cargar reemplaza solo la fuente identificada, no agrega duplicados. Para reconstruir todas las elecciones, `tools/build_data.py` reutiliza el suplemento ya validado; sigue requiriendo las fuentes historicas originales.

Pruebas ejecutadas:

```powershell
python tools/test_jepba_2025.py
node tools/test_election_capabilities.mjs
node tools/test_simulator.mjs
node tools/test_simulator_territory.mjs
python -m http.server 8765 --bind 127.0.0.1
# En otra terminal, Playwright disponible via NODE_PATH; Edge instalado:
node tools/test_jepba_ui.cjs
# Prueba preexistente: configurar PLAYWRIGHT_CHROMIUM_EXECUTABLE si corresponde.
node tools/test_simulator_ui.cjs
```

La prueba Python utiliza el snapshot predeterminado documentado. La UI prueba cambio desde circuito/localidad, seleccion de partido, comparacion en ambos sentidos, ausencia de participacion artificial, blancos, continuidad, cruce, limpieza de mapas fijados, exportacion CSV de 135 partidos, informe con fuente y limitaciones, navegacion de las ocho elecciones anteriores, mapa con pixeles pintados y vistas escritorio/movil. Todas estas pruebas pasaron. Los mosaicos del mapa base dependen de disponibilidad externa; las geometrías electorales son locales y se comprobaron independientemente. No se ha publicado ni enviado cambios al remoto.

## Inventario de cambios

Archivos creados:

- `tools/import_jepba_2025.py`: descarga, normalizacion, validacion y carga independientes.
- `data/jepba_2025.json`: suplemento de publicacion por partido.
- `js/election-capabilities.mjs`: contrato compartido de niveles y metricas disponibles.
- `tools/test_jepba_2025.py`: seis pruebas de parser, snapshot, conciliacion, idempotencia y preservacion.
- `tools/test_election_capabilities.mjs`: intersecciones de niveles y metricas.
- `tools/test_jepba_ui.cjs`: pruebas funcionales en Edge/Playwright.
- `docs/jepba-2025.md`: esta documentacion.

Archivos modificados:

- `tools/build_data.py`: incorpora el suplemento al regenerar el dataset.
- `data/electoral_data.json`: nueva fuente y 135 resultados territoriales.
- `js/app.js`: capacidades territoriales, nulabilidad, metricas, leyendas e informe.
- `js/simulator-model.mjs`: selecciona una base con total de votantes disponible.
- `index.html`: nota de alcance, fuente metodologica y versiones de cache.
- `css/styles.css`: oculta controles no disponibles y ajusta la nota de totales.

Se preservaron las modificaciones preexistentes del simulador y de otros archivos. No se integro ni modifico el indice ADN en esta entrega.
