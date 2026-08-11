# Atlas Electoral PBA

Aplicacion web estatica para explorar resultados electorales de la Provincia de Buenos Aires por partido, localidad y circuito electoral. Integra ocho elecciones, datos censales 2022, cartografia y herramientas interactivas para analizar participacion, ausentismo, composicion del voto, desempeno por fuerza, competitividad y variaciones entre elecciones.

## Captura

> Placeholder: agregar una captura de la interfaz principal del atlas.

## Funcionalidades principales

- Mapa interactivo con vistas por Partido, Localidad y Circuito.
- Filtros por eleccion, comparacion temporal, indicador, tipo de voto y fuerza politica.
- KPIs territoriales y composicion del voto total.
- Distribucion de votos positivos por fuerza.
- Ranking de territorios segun la metrica activa.
- Asistente de preguntas analiticas.
- Continuidad y alternancia electoral para dos o mas elecciones.
- Cruces socioelectorales con 79 indicadores censales relativos, correlacion de Pearson, tabla y CSV.
- Exportacion CSV y modo informe.
- Acceso en interfaz a documentacion metodologica.

## Fuentes de datos

- DINE / resultados electorales: <https://www.argentina.gob.ar/dine/resultados-electorales>
- Cartografia de partidos de Provincia de Buenos Aires desde datos abiertos: <https://portalgeoestadistico.indec.gob.ar/>
- Cartografía digital de Circuitos Electorales de Buenos Aires | Cámara Nacional Electoral: <https://mapa2.electoral.gov.ar/descargas/>
- INDEC / Censo Nacional de Población, Hogares y Viviendas 2022.
- Correspondencias radio–circuito y radio–localidad por CLC; la localidad principal del circuito se deriva por unicidad o mayor población 2022.
- Polígonos oficiales de las 219 localidades censales bonaerenses de más de 2.000 habitantes.

## Estructura del proyecto

```text
.
├── index.html
├── css/
│   ├── styles.css
│   └── socioeconomic.css
├── js/
│   └── app.js
├── data/
│   ├── electoral_data.json
│   ├── socioeconomic_data.json
│   ├── partidos_socioeconomicos.json
│   ├── localidades_socioeconomicas.json
│   ├── circuitos_socioeconomicos.json
│   ├── partidos_pba.geojson
│   ├── localidades_pba_mas2000.geojson
│   └── circuitos_pba.geojson
├── docs/
│   ├── documentacion-tecnica.md
│   ├── documentacion-metodologica.md
│   ├── auditoria_datos.md
│   ├── auditoria_datos.json
│   ├── auditoria_socioeconomica.md
│   └── auditoria_socioeconomica.json
└── tools/
    ├── build_data.py
    ├── build_socioeconomic.py
    ├── xlsx_reader.py
    ├── audit_data.py
    ├── audit_socioeconomic.py
    └── audit_circuit_matches.py
```

## Como ejecutar localmente

Desde esta carpeta, iniciar un servidor estatico:

```bash
python -m http.server 8000
```

Luego abrir:

```text
http://localhost:8000/
```

Tambien puede servirse con cualquier servidor estatico equivalente. Se recomienda evitar abrir `index.html` directamente como archivo local para asegurar que las cargas `fetch` de datos funcionen correctamente.

La ejecución actual requiere conexión a Internet para cargar Leaflet 1.9.4 desde unpkg y el mapa base Argenmap del IGN. Los datos analíticos y las geometrías territoriales sí están incluidos en el repositorio.

## Como desplegar

La aplicacion es compatible con hosting estatico y GitHub Pages. Para desplegar:

1. Publicar la carpeta manteniendo su estructura interna.
2. Verificar que `index.html` pueda acceder a `css/`, `js/`, `data/` y `docs/` con rutas relativas.
3. Actualizar los cache-busters de CSS y JavaScript en `index.html` cuando se modifiquen esos archivos.

## Documentacion disponible

- [Documentacion tecnica](docs/documentacion-tecnica.md)
- [Documentacion metodologica](docs/documentacion-metodologica.md)
- [Auditoria de datos electorales](docs/auditoria_datos.md)
- [Auditoria socioeconomica](docs/auditoria_socioeconomica.md)
- [Auditoria final de produccion](docs/auditoria_produccion.md)

## Licencia

No se identifico una licencia en esta carpeta. Agregar la licencia correspondiente antes de una publicacion amplia si aplica.

## Creditos

Proyecto desarrollado para el analisis territorial de resultados electorales en la Provincia de Buenos Aires por Santiago Linares y Juan Suasnábar - Contacto: slinaresgeo@gmail.com
