# Auditoría final de producción

Estado: **OK**

## Resultado

- Recursos iniciales verificados: 5.
- Geometrías: partidos 135, localidades 219 y circuitos 1.153; inválidas: 0.
- Localidades con resultados electorales: 206; solo secundarias: 13.
- Relaciones secundarias circuito–localidad: 18.
- Variables socioeconómicas: 80; exportaciones: partido 135, localidad 219, circuito 1.153.
- Rutas locales en producción: 0; logs temporales: 0; IDs DOM faltantes: 0.

## Errores críticos

- Ninguno.

## Advertencias

- Recursos mayores a 10 MB sin comprimir: electoral_data.json=10.91 MB, partidos_pba.geojson=15.40 MB

- La ejecución depende de Leaflet 1.9.4 en unpkg y del mapa base Argenmap del IGN; requiere conectividad externa.

## Límite de QA visual

- La inspección visual automatizada en navegador no pudo ejecutarse por un error del entorno aislado de Windows; se sustituyó por validación HTTP, DOM, sintaxis, datos y geometrías.
