# Documentacion tecnica

## Descripcion general

Atlas Electoral PBA es una aplicacion web estatica para explorar resultados electorales de la Provincia de Buenos Aires con lectura territorial por partido, localidad y circuito electoral. El visor combina datos electorales procesados, geometria territorial y componentes interactivos para analizar participacion, ausentismo, composicion del voto, desempeno de fuerzas politicas, competitividad y variaciones entre elecciones.

La aplicacion esta pensada como un tablero exploratorio: permite recorrer el mapa, aplicar filtros, consultar rankings, abrir un asistente de preguntas analiticas, cruzar metricas en un grafico de dispersion y exportar informacion o informes.

## Arquitectura general

La arquitectura es de despliegue estatico. No requiere backend en tiempo de ejecucion: el navegador carga HTML, CSS, JavaScript y archivos locales de datos.

Componentes principales:

- `index.html`: estructura de la interfaz, referencias a Leaflet, estilos y modulo JavaScript principal.
- `css/styles.css` y `css/socioeconomic.css`: sistema visual, layout, paneles, mapa, rankings, asistente, modo informe y componentes superpuestos.
- `js/app.js`: estado de la aplicacion, carga de datos, transformaciones, renderizado del mapa y controles.
- `data/electoral_data.json`: ocho elecciones procesadas para partidos, localidades y circuitos.
- `data/socioeconomic_data.json`: 79 indicadores censales relativos y una población total derivada, agregados para los tres niveles territoriales.
- `data/partidos_pba.geojson`: geometria de partidos de la Provincia de Buenos Aires.
- `data/localidades_pba_mas2000.geojson`: 219 polígonos oficiales normalizados por CLC.
- `data/circuitos_pba.geojson`: geometria de circuitos electorales y relaciones completas con CLC.
- `data/partidos_socioeconomicos.json`, `data/localidades_socioeconomicas.json` y `data/circuitos_socioeconomicos.json`: exportaciones independientes de métricas porcentuales.
- `docs/`: documentacion tecnica, metodologica y auditorias de datos.
- `tools/`: scripts de construccion y auditoria de datos.

## Estructura de carpetas

```text
05_MapaElectoral_Cockpit_CSV/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── data/
│   ├── electoral_data.json
│   ├── partidos_pba.geojson
│   └── circuitos_pba.geojson
├── docs/
│   ├── documentacion-tecnica.md
│   ├── documentacion-metodologica.md
│   ├── auditoria_datos.md
│   └── auditoria_datos.json
├── tools/
│   ├── build_data.py
│   ├── audit_data.py
│   └── audit_circuit_matches.py
└── README.md
```

## Tecnologias utilizadas

- HTML5 para la estructura de la aplicacion.
- CSS3 sin framework para layout, componentes y responsividad.
- JavaScript en modulo ES para la logica de interaccion.
- Leaflet 1.9.4 para visualizacion cartografica.
- GeoJSON para geometria territorial.
- JSON y CSV como formatos de datos electorales y de procesamiento.
- Python para scripts de construccion y auditoria de datos.

## Diseno de interfaz

### Layout general

La interfaz principal se organiza en tres zonas: panel lateral de filtros, mapa central y paneles de detalle/ranking/KPIs. El layout usa CSS Grid y se adapta a pantallas pequenas mediante reglas responsivas.

### Panel de filtros

El panel lateral contiene:

- selector de modo de vista: por eleccion o comparacion temporal;
- selectores de elecciones base y comparada;
- selector de indicador del mapa;
- controles dependientes para tipo de voto, fuerza politica y forma de medicion;
- accesos al asistente, cruce de metricas, exportacion CSV y modo informe.

### Mapa

El mapa usa Leaflet con capas GeoJSON para partidos, 219 localidades oficiales y circuitos. El buscador sigue la unidad activa. El mapa flotante es un único componente parametrizado por partido o localidad; en Localidad distingue relaciones secundarias mediante trazo discontinuo.

### KPIs

La tira de KPIs resume indicadores sinteticos del universo territorial filtrado o seleccionado, como electores, participacion, ausentismo y otros valores relevantes segun la vista activa.

### Graficos

La aplicacion incluye barras apiladas para composicion del voto total y distribucion de votos positivos, y un grafico de dispersion SVG para cruces exploratorios entre metricas.

### Ranking

El ranking ordena partidos, localidades o circuitos segun la metrica activa y el criterio definido por el modo de lectura. Permite seleccionar territorios desde la lista y abre un perfil socioeconomico reutilizable mediante `Ver perfil`. La tabla territorial del grafico de dispersion ofrece la misma accion.

### Continuidad y ventanas territoriales

Continuidad genera desde los metadatos electorales un desplegable de casillas, exige dos elecciones y conserva la seleccion durante la sesion. El refresco general vuelve a calcular mapa, KPIs, leyenda, ranking, exportacion y detalle territorial. En este modo, el clic sobre un poligono actualiza el panel permanente situado bajo el mapa; fuera de Continuidad se conserva el comportamiento territorial previo.

El panel de Continuidad representa cada elección mediante una barra apilada al 100 % construida con votos absolutos por fuerza sobre votos positivos. El perfil socioeconomico conserva el modal reutilizable: `Escape` cierra la ventana activa y el foco vuelve al control que la abrio.

### Asistente

El asistente contiene preguntas analiticas predefinidas. Cada pregunta ajusta filtros, unidad territorial, ordenamiento y, en algunos casos, abre el cruce de metricas.

### Exportacion de informe

La aplicacion permite exportar CSV y activar un modo informe con secciones de lectura ejecutiva, mapa, KPIs y graficos principales.

## Flujo de datos

### Carga de datos

Al inicializar, `app.js` carga en paralelo:

- `data/electoral_data.json`;
- `data/partidos_pba.geojson`;
- `data/localidades_pba_mas2000.geojson`;
- `data/circuitos_pba.geojson`;
- `data/socioeconomic_data.json`.

### Transformacion

Los datos electorales ya llegan procesados desde los scripts de `tools/`. En el navegador se realizan transformaciones ligeras para calcular valores derivados, preparar rankings, generar puntos de dispersion y construir textos de lectura.

### Calculo de metricas

Las metricas principales se calculan desde estructuras de datos por eleccion y unidad territorial. La aplicacion evalua participacion, ausentismo, competitividad, tipos de voto, porcentajes por fuerza y variaciones entre elecciones.

### Renderizado

El renderizado se actualiza desde una funcion de refresco general que sincroniza mapa, leyenda, KPIs, detalle territorial, barras, ranking, asistente y grafico de dispersion.

## Componentes principales de JavaScript

- `state`: objeto central con mapa, datos, seleccion territorial, filtros activos y caches.
- `METRICS`, `SCATTER_METRICS`, `SCATTER_ELECTORAL_METRICS`, `PROFILE_MAIN_INDICATORS`, `SOCIO_DIMENSIONS`, `SOCIO_FAMILIES` y `QUESTIONS`: configuraciones declarativas de metricas, capa de presentación, familias socioeconómicas, perfil y preguntas.
- Funciones de formato: porcentajes, puntos porcentuales y numeros.
- Funciones de acceso a datos: recuperan filas por unidad y eleccion.
- Funciones de metrica: calculan valores actuales, variaciones y valores de ranking.
- Funciones de mapa: crean capas, estilos, tooltips, seleccion y busqueda.
- Funciones de UI: actualizan filtros, leyendas, paneles, KPIs, ranking y textos.
- Funciones de exportacion: generan CSV y modo informe.
- Inicializacion: carga datos, construye controles y registra eventos.

## Manejo de estado

El estado se mantiene en memoria dentro del objeto `state`. Los controles modifican valores de ese objeto y luego llaman a la actualizacion de la interfaz. No se usa almacenamiento persistente ni gestion de estado externa.

Campos relevantes:

- eleccion base y eleccion objetivo;
- modo de vista;
- indicador, tipo de voto, fuerza y medida positiva;
- partido o circuito seleccionado;
- nivel de mapa;
- seleccion del grafico de dispersion;
- referencias a capas Leaflet y caches de centroides.

## Infraestructura

### Despliegue estatico

La aplicacion puede servirse desde cualquier hosting estatico. Solo requiere que las rutas relativas a `css/`, `js/`, `data/` y `docs/` se conserven.

### GitHub Pages

Es compatible con GitHub Pages si la carpeta publicada mantiene la misma estructura interna. Los recursos se cargan con rutas relativas.

### Dependencias externas

La dependencia externa de ejecucion es Leaflet, cargada desde `https://unpkg.com`. No se agregan frameworks ni dependencias pesadas.

### Servicios de mapas base

El mapa base usa servicios de teselas del Instituto Geografico Nacional mediante ArgenMap.

### Archivos de datos locales

Los datos electorales y cartograficos se almacenan localmente en `data/`. Esto evita depender de una API externa durante el uso de la aplicacion.

## Consideraciones de mantenimiento

- Mantener sincronizados los datos electorales y las geometria territorial.
- Revisar auditorias de datos antes de publicar una nueva version.
- Actualizar cache-busters de `index.html` cuando cambien `css/styles.css` o `js/app.js`.
- Evitar cambios de estructura en `data/` sin actualizar las funciones de lectura.
- Validar que la aplicacion funcione desde rutas relativas para GitHub Pages.

## Posibles mejoras futuras

- Incorporar mas elecciones y cargos.
- Agregar validacion mas fina de correspondencias entre circuitos electorales y geometria.
- Permitir descarga de informes en formatos adicionales.
- Incorporar capas socioeconomicas o censales.
- Agregar busqueda avanzada y filtros territoriales combinados.
- Publicar una guia de actualizacion de datos paso a paso.

## Canal de construcción reproducible

- `tools/build_data.py` descubre y procesa los CSV DINE, deriva el CLC principal de cada circuito desde radios y población 2022, valida cierres y genera los JSON/GeoJSON electorales.
- `tools/xlsx_reader.py` realiza lectura incremental de XLSX sin requerir Excel.
- `tools/build_socioeconomic.py` valida el universo de 23.880 radios, agrega circuito mediante radio–circuito y localidad mediante CLC radio–localidad, deriva población total y genera los tres JSON socioeconómicos finales.
- `tools/radio_locality.py` clasifica circuitos con CLC único, sin localidad urbana o multilocalidad; en este último caso usa la población 2022 y genera la auditoría reproducible.
- `tools/audit_data.py` y `tools/audit_socioeconomic.py` generan reportes JSON y Markdown y detienen el proceso ante discrepancias críticas.

El dataset socioeconómico declara procedencia, año, universo, numerador, denominador, método y controles de cierre por variable. La capa de presentación del navegador separa variable conceptual, categoría, nombre corto y definición completa sin alterar los nombres de fuente. La aplicación carga los cuatro recursos de datos en paralelo. El gráfico de dispersión admite cambios electorales, métricas de una elección e indicadores censales en cualquiera de los ejes; calcula r de Pearson y R² solo con casos completos y exporta todas las observaciones a CSV.

## Excepciones controladas

La relación radio-circuito es provisional porque fue construida con centroides de radio. El auditor exige que las cuatro asignaciones interpartidarias conocidas y los cuatro circuitos sin radio coincidan exactamente con el inventario aprobado. Los radios interpartidarios se excluyen al elegir la localidad principal. La fuente radio–localidad debe cerrar en 23.880 radios, 19.967 CLC no nulos, 3.913 nulos y 219 localidades oficiales; cualquier diferencia cambia el estado de auditoría a crítico.
