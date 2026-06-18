# Atlas Electoral PBA

Aplicacion web estatica para explorar resultados electorales de la Provincia de Buenos Aires por partido y circuito electoral. Integra datos electorales, cartografia y herramientas interactivas para analizar participacion, ausentismo, composicion del voto, desempeno por fuerza, competitividad y variaciones entre elecciones.

## Captura

> Placeholder: agregar una captura de la interfaz principal del atlas.

## Funcionalidades principales

- Mapa interactivo con vista por Partido y por Circuito.
- Filtros por eleccion, comparacion temporal, indicador, tipo de voto y fuerza politica.
- KPIs territoriales y composicion del voto total.
- Distribucion de votos positivos por fuerza.
- Ranking de territorios segun la metrica activa.
- Asistente de preguntas analiticas.
- Cruce exploratorio de metricas en grafico de dispersion.
- Exportacion CSV y modo informe.
- Acceso en interfaz a documentacion metodologica.

## Fuentes de datos

- DINE / resultados electorales: <https://www.argentina.gob.ar/dine/resultados-electorales>
- Cartografia de partidos de Provincia de Buenos Aires desde datos abiertos: <(https://portalgeoestadistico.indec.gob.ar/)>
- Cartografía digital de Circuitos Electorales de Buenos Aires | Cámara Nacional Electoral: <https://mapa2.electoral.gov.ar/descargas/>

## Estructura del proyecto

```text
.
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
└── tools/
    ├── build_data.py
    ├── audit_data.py
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

## Como desplegar

La aplicacion es compatible con hosting estatico y GitHub Pages. Para desplegar:

1. Publicar la carpeta manteniendo su estructura interna.
2. Verificar que `index.html` pueda acceder a `css/`, `js/`, `data/` y `docs/` con rutas relativas.
3. Actualizar los cache-busters de CSS y JavaScript en `index.html` cuando se modifiquen esos archivos.

## Documentacion disponible

- [Documentacion tecnica](docs/documentacion-tecnica.md)
- [Documentacion metodologica](docs/documentacion-metodologica.md)
- [Auditoria de datos](docs/auditoria_datos.md)

## Licencia

No se identifico una licencia en esta carpeta. Agregar la licencia correspondiente antes de una publicacion amplia si aplica.

## Creditos

Proyecto desarrollado para el analisis territorial de resultados electorales en la Provincia de Buenos Aires por Santiago Linares y Juan Suasnábar - Contacto: slinaresgeo@gmail.com
