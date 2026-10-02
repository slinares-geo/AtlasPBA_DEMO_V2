# Simulador de escenarios

## Datos y escenario provincial

El simulador toma la elección más reciente que tiene datos provinciales. Ordena por año y, si existe, por fecha ISO; cuando faltan fechas desempata por la elección predeterminada y el identificador, con una advertencia visible. Los metadatos actuales contienen año, sin fecha completa.

Se agregan todos los partidos de esa elección, sin los filtros territoriales del Atlas. Las fuerzas provienen de `fuerzas`. El porcentaje es votos de la fuerza / votos positivos; los agregados usan cocientes de sumas y nunca promedios de porcentajes territoriales. Los datos observados se conservan y no se escriben datasets.

El escenario provincial permanece en una ventana modal. Los sliders y campos numéricos ajustan el objetivo y, opcionalmente, la participación. La primera apertura selecciona la fuerza más votada; cambiar de fuerza restablece sus parámetros. Restablecer parámetros conserva la fuerza y la selección territorial. Los parámetros y la selección persisten al cerrar y reabrir, pero no entre recargas.

Supuestos del cálculo:

- Padrón constante. Sin aumento de participación, votantes y positivos permanecen constantes.
- Nuevos votantes provinciales = redondeo(participación solicitada × electores) − votantes observados.
- Cada nuevo votante aporta un positivo. El denominador objetivo es positivos observados + nuevos votantes.
- Votos objetivo = techo(porcentaje solicitado × denominador objetivo). Se conserva exactamente el resultado inicial cuando no hay cambios.
- Votos adicionales necesarios = votos objetivo − votos observados de la fuerza elegida.
- El potencial incluye los votos positivos de **todas las otras fuerzas**, cualquiera sea su posición, más los nuevos votos previstos. Excluye votos ya propios, blancos y nulos.

La comparación provincial muestra la capacidad máxima disponible. Para describir fuentes que podrían cubrir el objetivo, el modelo utiliza primero capacidad de otras fuerzas y después nuevos votos; el resto de nuevos votos queda sin asignación partidaria. Esta composición es hipotética y no afirma transferencias efectivas ni probabilidades de captación. Con todas las otras fuerzas disponibles, los objetivos válidos hasta el 100% de positivos tienen capacidad provincial suficiente.

La lógica pura está en `js/simulator-model.mjs`; la interfaz provincial está en `js/simulator.mjs`.

## Potencial de los partidos seleccionados y barra de progreso

Explorar partidos minimiza el escenario en el panel izquierdo y abre una vista del Atlas con controles y lista a la izquierda, mapa y scatter en el centro y cobertura del objetivo a la derecha. La izquierda conserva la situación provincial observada y objetivo, con votos, porcentajes y votos adicionales necesarios. Si aumenta la participación, cada porcentaje usa el denominador de su situación.

El resumen territorial utiliza el mismo escenario provincial. La selección no recalcula el objetivo: reúne capacidad potencial para compararla con los votos adicionales necesarios.

Para cada partido:

1. Votos de otras fuerzas = positivos observados − votos observados de la fuerza elegida.
2. Nuevos votos previstos = nuevos votantes provinciales × abstenciones del partido / abstenciones provinciales.
3. Potencial = votos de otras fuerzas + nuevos votos previstos.

La distribución de nuevos votos se calcula una vez para toda la provincia con cantidades enteras: se toma la parte entera y se distribuyen los restos mayores, con desempate por código territorial. Conserva exactamente el total provincial, no supera las abstenciones de cada partido y no cambia cuando se seleccionan o quitan partidos. Si no aumenta la participación, el aporte nuevo es cero. No se cuentan todas las abstenciones como nuevos votos. Una cobertura territorial inconsistente se rechaza en lugar de corregir silenciosamente la fuente.

El panel suma el potencial de los partidos seleccionados y muestra:

- Votos adicionales necesarios para el objetivo provincial.
- Potencial seleccionado, con desglose entre otras fuerzas y nuevos votos previstos.
- Votos potenciales faltantes, o excedente cuando hay suficiente capacidad.
- Barra de progreso = potencial seleccionado / votos adicionales necesarios. La barra llega como máximo al 100%; el texto conserva la cobertura real y el excedente.
- Cuando hay suficiente potencial, proporción que sería necesario captar = votos adicionales necesarios / potencial seleccionado.

Ejemplo: un objetivo necesita 20.000 votos adicionales; la selección reúne 13.000 votos de otras fuerzas y 10.000 nuevos votos previstos. El potencial es 23.000, la cobertura es 115%, el excedente es 3.000 y habría que captar el 87% del potencial para cubrir el objetivo. Con un objetivo igual al resultado observado, se indica que no hacen falta votos adicionales y no se divide por cero.

La barra mide **capacidad máxima**, no votos obtenidos ni probabilidad de alcanzar el objetivo. Los datos observados del conjunto quedan en un desplegable separado. La lógica territorial está en `js/simulator-territory-model.mjs`.

## Mapa, selección y navegación

La exploración conserva las proporciones originales de columnas, el marco del mapa, la marca, los bordes y los espaciados del Atlas. Reutiliza la misma instancia Leaflet con una capa temporal de partidos interactiva: violeta indica selección y el relleno restante no representa resultados simulados. Los tooltips muestran datos observados. Si faltan geometrías se informa en la nota del mapa.

Mapa, lista y scatter alternan la misma selección. La búsqueda normaliza acentos y atenúa puntos sin alterar los seleccionados. Limpiar también retira el resaltado del mapa; Deshacer recupera la selección anterior. Ver partidos en el mapa sólo encuadra la selección. No hay selección inicial ni prioridades automáticas.

Editar escenario abre de nuevo la ventana provincial; cerrarla o Escape regresa a la exploración. Volver al Atlas o Escape desde la exploración restaura la vista anterior. Las capas, filtros, elección, nivel, selección, cámara y desplazamiento del Atlas se conservan; se retira por completo la capa temporal y su renderer. En móvil los paneles se apilan y el resumen muestra su contenido completo.

## Scatter y ventana flotante

- X: competitividad, diferencia entre primera y segunda fuerza / votos positivos, en puntos porcentuales. Menor margen implica mayor competencia y no depende de la fuerza elegida.
- Y: volumen electoral, votantes observados; no se rotula como votos potenciales.
- Sin cambio de participación, todos los puntos tienen igual tamaño. Con aumento activo, el área representa abstenciones observadas, mediante radio proporcional a su raíz cuadrada y un mínimo visible.
- La región de interacción tiene un tamaño mínimo independiente del tamaño del punto. Clic, Enter o espacio alternan la selección.
- Lazo es una opción reversible: un polígono incluye centros dentro o sobre su borde y reemplaza la selección. Cancelar conserva la selección anterior.
- Acercar a selección ajusta los dominios; Vista completa los restituye.
- Separar partidos pequeños activa log(votantes + 1), incluyendo cero. Etiquetas y fichas conservan cantidades reales. La transformación no cambia los agregados.

Ampliar gráfico mueve la misma instancia a una **ventana flotante no modal**, conservando selección, escala y acercamiento. Se arrastra desde el encabezado y se redimensiona desde la esquina inferior derecha. El mapa y la lista siguen disponibles. Acoplar gráfico o Escape devuelve el scatter a su panel; ese Escape no sale de la exploración. Al volver al Atlas también se acopla automáticamente. La ventana se mantiene dentro de los límites visibles al cambiar el tamaño de pantalla.

## Verificación reproducible

- `node tools/test_simulator.mjs`: todas las fuerzas, identidad inicial, participación constante y ampliada, conservación, límites, empates y parámetros inválidos.
- `node tools/test_simulator_territory.mjs`: 135 partidos y 15 fuerzas, conservación provincial del reparto de nuevos votos, capacidad territorial, monotonicidad de cobertura, faltante/excedente, objetivo cero, casos sin abstenciones, desempate determinista, agregados, lazo e inmutabilidad.
- `node tools/test_simulator_ui.cjs`: requiere Playwright y servidor local en puerto 8765. Admite `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Verifica el marco original del Atlas, comparación de partida/objetivo, progreso al seleccionar, cobertura suficiente, sincronización mapa/lista/scatter, lazo, tamaños según participación, escala, acercamiento, movimiento y redimensionado flotante, interacción con la lista mientras está abierto, Escape, persistencia, restauración del Atlas y diseño móvil.
