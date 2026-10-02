# Integracion del indice precalculado

## Cambiar el nombre

Editar **unicamente** `ADN_NAME` en `js/indicator-config.mjs`:

```javascript
export const ADN_NAME = 'Afinidad Socioelectoral';
```

Ese nombre alimenta selector del mapa, tooltips, listado territorial, perfil, dimension de indices compuestos, selectores y ejes de cruces, exportaciones e informe. La etiqueta de las leyendas y el subtitulo del KPI se configura por separado en `ADN_LEGEND_LABEL = 'Afinidad'`, en el mismo archivo. No requiere reconstruir datos. Recargar el navegador despues de editar; si conserva una version anterior, realizar una recarga forzada.

`ADN_ID = 'adn'` es una clave tecnica permanente. No modificarla al renombrar. Los nombres de archivos, columnas, versiones historicas y evidencias originales se conservan para trazabilidad.

## Datos y union

Fuente aprobada: `G:\Unidades compartidas\Análisis de datos\99_FCH\07_Elecciones\02_Datos\04_Socioeconomicos\ADN\v1_experimental_20261002`.

Version: `ADN_v1_experimental`. Referencia: `PBA_circuitos_Censo2022_20261002`.

`tools/import_adn.py` valida y empaqueta los tres JSON existentes en `data/adn.json`. No lee el Excel, no regenera los componentes y no recalcula el indice. Preserva exactamente cada puntaje exportado, con sus componentes, aportes, estado y motivo de ausencia. Verifica diez aportes por puntaje, hashes censales/cartograficos, unicidad, FK de partido y cobertura de las nueve elecciones actuales.

| Nivel | PK exacta de texto | Filas | Con puntaje |
| --- | --- | ---: | ---: |
| Partido | INDEC de 5 caracteres; ejemplo `06518` | 135 | 135 |
| Localidad | CLC de 8 caracteres; ejemplo `06518060` | 219 | 219 |
| Circuito | Clave Atlas con letras/sufijos; ejemplos `622A`, `314_2` | 1157 | 1149 |

PK conjunta: `(nivel_app, territorio_id)`. No usar nombres territoriales para unir ni convertir las claves a numeros. La eleccion no forma parte de la clave censal. Los 8 circuitos sin puntaje son `128`, `313`, `338B`, `383`, `388`, `548`, `933`, `961C`. Cuatro son historicos sin geometria; nunca se imputan ceros.

Los datos censales originales y `electoral_data.json` no se modifican. El loader une el paquete a una copia en memoria de `socioeconomic_data`, reutilizando los perfiles y cruces existentes. Al reconstruir las elecciones, `data/adn.json` sigue independiente.

## Calculo y escala

Se conservan los pesos y las inversiones originales de la entrega aprobada. Los extremos metodologicos fueron calculados sobre los 1149 circuitos provinciales completos y congelados; tambien se aplicaron a localidades y partidos. Cada nivel tiene su propio resultado precalculado desde conteos agregados, no un promedio de indices menores.

El navegador solo recupera los puntajes. No calcula una media de provincias, selecciones o partidos; no renormaliza por filtros. La paleta de cinco colores reproduce la prueba HTML aprobada. Su dominio visual fijo, comun a los tres niveles, es `[0.252868556343, 0.634246299338]`. Es una escala de color, no una nueva normalizacion del indice. Gris indica ausencia.

Se presenta el puntaje multiplicado por 100, con un decimal y signo `%`: `0.425 -> 42,5 %`. Esto solo cambia el formato de visualizacion, no la normalizacion, los pesos, las inversiones ni los colores. Los datos y CSV conservan el puntaje original con precision completa, no el porcentaje redondeado. El dominio visual se muestra como `25,3 % a 63,4 %`, sin estirarlo a 0-100. Es un puntaje experimental expresado porcentualmente, no porcentaje electoral ni probabilidad individual. Sus pesos siguen pendientes de validacion sustantiva. Persisten las salvedades originales sobre hacinamiento (1,5 personas/cuarto o mas), denominador de desocupacion y asignaciones radio-circuito provisionales; el paquete conserva `metadata.parameters.salvedades` y hashes de fuentes.

## Interfaz

- Mapa: selector **Que mostrar en el mapa**, en modo **Por eleccion**. Tres niveles y detalle territorial, con rampa fija.
- Perfil socioeconomico: quinto KPI arriba a la derecha en escritorio, con nombre configurable y subtitulo **Afinidad**; disposicion responsiva en pantallas estrechas. Se conserva la dimension **Indices compuestos** para explorar su definicion.
- Cruces: disponible en ambos ejes junto a los indicadores socioelectorales existentes; ausencia excluida, no convertida a cero.
- No aparece como diferencia en **Comparar**: el mismo Censo 2022 no varia entre elecciones. Si se cambia a ese modo, el selector vuelve a una metrica electoral compatible. Si se compara una variable electoral en un cruce, el indice mantiene su puntaje fijo.
- Las restricciones de la eleccion siguen vigentes: PBA provincial 2025 permite partido; las otras elecciones habilitan circuito/localidad. Los paneles de votos bajo el mapa siguen mostrando el contexto electoral elegido y no se reinterpretan como componentes del indice.
- Exportacion de la metrica: puntaje completo y referencia Censo 2022. Informe y cruces toman el nombre configurable.

## Archivos

Nuevos: `js/indicator-config.mjs`, `js/adn-model.mjs`, `tools/import_adn.py`, `data/adn.json`, `tools/test_adn.mjs`, `tools/test_adn_ui.cjs`, este documento.

Modificados: `js/app.js`, `index.html` (version de cache), `css/styles.css` (presentacion del puntaje). Se preservaron todos los cambios anteriores del usuario y de la integracion electoral.

## Repeticion y pruebas

Desde la raiz del repositorio:

```powershell
python tools/import_adn.py
node tools/test_adn.mjs
# Con Atlas servido en 8765, Playwright en NODE_PATH y Edge instalado:
node tools/test_adn_ui.cjs
```

`--source RUTA` selecciona otra carpeta de tablas ya calculadas; un cambio de fuentes censales/cartografia requiere revisar/versionar el indice, no omitir el control de hashes. El empaquetado es determinista, sin escritura sobre las tablas fuente.

Pruebas: 1511 claves exactas, 1503 puntajes, 8 nulos, aportes coherentes, copia no mutante e idempotente; interfaz en los tres niveles, colores y puntajes estables al filtrar/cambiar elecciones, perfiles, cruce, CSV e informe, PBA 2025, captura escritorio/movil y pixeles del mapa. Prueba adicional de renombre mediante sustitucion en memoria de una sola constante, sin editar los datos ni dejar el nombre de prueba.

No se hizo commit, push ni publicacion remota.
