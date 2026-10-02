# Evaluación y propuesta de simplificación del simulador

Fecha: 1 de octubre de 2026.

## Alcance y evidencia

Revisión de `js/simulator.mjs`, `js/simulator-territory.mjs`, `css/simulator.css`, `docs/simulador-escenarios.md` y del recorrido definido en `tools/test_simulator_ui.cjs`. Es una evaluación heurística de la estructura, los textos y los comportamientos definidos en el código. No se realizaron sesiones con usuarios ni se verificó el renderizado en navegador: el entorno impidió iniciar la inspección visual local. Los problemas de comprensión se plantean como hipótesis fundamentadas, no como resultados de pruebas de usabilidad.

La propuesta no modifica la aplicación, los datos ni las reglas de simulación. La maqueta adjunta es un boceto de organización, sin cálculos ni datos electorales.

## Evaluación general

El simulador ofrece controles iniciales relativamente simples, distingue lo observado de lo simulado y permite consultar los supuestos. También conserva la selección territorial al cerrar y reabrir, ofrece selección mediante teclado y permite volver al Atlas con Escape. Son bases útiles que conviene preservar.

La principal dificultad es que muestra en una única superficie cuatro tareas distintas: configurar un objetivo, comprender cómo se obtiene, comparar resultados y explorar territorios. Los indicadores tienen casi el mismo peso visual, aunque algunos responden a la pregunta principal y otros sólo justifican el cálculo.

El recorrido debería responder, en este orden:

1. ¿Qué fuerza quiero analizar y qué porcentaje quiero alcanzar?
2. ¿Qué resultado permite este modelo y cuántos votos adicionales requiere?
3. ¿De dónde provienen esos votos bajo los supuestos elegidos?
4. Si me interesa, ¿cómo se compara esa magnitud con determinados partidos?

## Hallazgos y cambios propuestos

| Prioridad | Evidencia en la interfaz actual | Dificultad probable | Propuesta |
| --- | --- | --- | --- |
| Alta | 8 indicadores provinciales, o 12 al aumentar participación; 12 territoriales, o 14 con participación; más una tabla de 6 filas. | No queda claro qué leer primero. Hay repeticiones entre tarjetas, tabla y textos. | Mostrar tres resultados principales; trasladar cantidades de control y comparación completa a un detalle desplegable. |
| Alta | El porcentaje solicitado aparece como tarjeta; el porcentaje alcanzable está en la tabla. | Un usuario puede interpretar el objetivo como resultado, especialmente si es imposible. | Dar el mayor énfasis al porcentaje alcanzable, con objetivo y brecha inmediatamente al lado. |
| Alta | El estado inicial anuncia que el escenario es alcanzable, aunque no hubo cambios. | No se diferencia la línea de base de una simulación efectivamente modificada. | Estado inicial: «Todavía no modificaste el resultado observado». Actualizar el estado al cambiar parámetros. |
| Alta | Los porcentajes se ajustan sólo con sliders, con `step="any"`, y se muestran con tres decimales. | Es difícil introducir una cifra exacta; la precisión visual supera la necesaria para una exploración inicial. | Slider acompañado por campo numérico editable y botones de incremento. Mostrar una cifra decimal en el resumen y precisión completa en detalle. La presentación redondeada no debe alterar el cálculo ni el estado inicial exacto. |
| Alta | «Fuerza superior», «denominador», «intensidad relativa» y «competitividad» concentran conceptos técnicos. | El usuario debe traducir las etiquetas para entender el efecto del escenario. | «Fuerza de origen de la transferencia», «Total de votos positivos» y «Votos adicionales / votos positivos de la selección». Explicar el margen como diferencia entre primera y segunda fuerza. |
| Alta | El análisis territorial aparece seguido de todos los resultados provinciales dentro de un diálogo con scroll. | Se pierde la relación entre controles y resultado al desplazarse; el cierre también se desplaza. | Dos vistas: «Escenario provincial» y «Explorar partidos». Encabezado persistente con cierre y contexto resumido. En escritorio, controles junto al resultado; en móvil, controles seguidos del resumen. |
| Alta | Gráfico con ancho mínimo de 600 px, scroll horizontal y `touch-action: none`. | En móvil, el gesto de desplazarse compite con el gesto de seleccionar. El lazo exige precisión y los puntos pequeños pueden resultar difíciles de tocar. | Lista con búsqueda y casillas como opción principal en móvil y alternativa universal. Activar el modo «Seleccionar con lazo» explícitamente en el gráfico. |
| Alta | El margen del gráfico se calcula entre primera y segunda fuerza, independientemente de la fuerza seleccionada. | El contexto del simulador puede hacer pensar que es el margen de la fuerza analizada. | Eje: «Diferencia entre 1.ª y 2.ª fuerza (pp)». Ayuda breve: «A la izquierda, elecciones más parejas; este margen no corresponde necesariamente a la fuerza elegida». |
| Media | Cambiar fuerza reinicia porcentaje y participación; «Restablecer escenario» vuelve a la fuerza inicial, pero conserva partidos. | Los efectos de las acciones no son evidentes antes de ejecutarlas. | Ayuda junto al selector: «Al cambiar de fuerza se reinician los parámetros». Separar «Restablecer parámetros» de «Limpiar selección de partidos» y definir explícitamente si el primero mantiene la fuerza actual. |
| Media | Un nuevo lazo reemplaza la selección. | Se puede perder una selección acumulada al intentar agregar partidos. | Modo visible «Reemplazar selección / Agregar a selección» y acción «Deshacer última selección». Para una primera versión, conservar reemplazo con instrucción permanente y deshacer. |
| Media | «Ver selección en el mapa» está disponible sin selección y cierra el diálogo. | La acción puede resultar vacía y el usuario no sabe cómo regresar al escenario. | Deshabilitarla con selección vacía; con selección, «Ver N partidos en el Atlas». Ofrecer acceso explícito de vuelta al simulador conservando el estado. |
| Media | El tooltip reúne numerosas métricas en un párrafo bajo el gráfico. | Consultar un punto obliga a leer una cadena extensa y asociarla con su posición. | Mostrar nombre, votos positivos y porcentaje de la fuerza en una ficha breve; incluir las otras métricas en «Más datos». Conservar el acceso por foco de teclado. |
| Media | Se reconstruye el SVG completo en cada cambio de parámetros o selección. | Puede producir pérdida de foco o de contexto al interactuar; falta comprobarlo en navegador. | Actualizar sólo los estados necesarios y probar que el foco y el desplazamiento se preserven. |

## Organización propuesta

### Encabezado común

Título «Simulador de escenarios», elección base y nota corta «Simulación hipotética sobre votos positivos provinciales». Botón «Volver al Atlas» siempre accesible. Si el simulador utiliza una elección distinta de la activa en el Atlas, señalar ambas explícitamente. La advertencia técnica sobre desempate de fechas debe quedar en «Elección base y metodología», con un aviso breve si afecta la selección.

Navegación de dos vistas sin obligación de avanzar por pasos:

- **Escenario provincial**, vista inicial para configurar y entender el resultado.
- **Explorar partidos**, vista opcional para comparar magnitudes territoriales.

Cambiar de vista conserva fuerza, objetivo, participación y partidos seleccionados. La elección base y el alcance provincial deben permanecer visibles: los filtros del Atlas no restringen este cálculo.

### Vista «Escenario provincial»

En escritorio, dos columnas. A la izquierda, un panel «Definí el escenario»:

1. Fuerza política.
2. Resultado observado, como referencia breve.
3. «Porcentaje objetivo», con slider y entrada numérica sincronizados. Aclarar que este modelo sólo permite mantener o aumentar el porcentaje observado.
4. «Participación», inicialmente «Mantener la observada». La opción «Aumentar» habilita el valor objetivo y muestra cuántos nuevos votantes supone.
5. «Restablecer parámetros», con alcance explícito.

A la derecha, un panel «Resultado del escenario» con tres resultados principales:

- **Porcentaje alcanzable**, acompañado por el porcentaje observado y su variación en puntos porcentuales.
- **Porcentaje objetivo**, con brecha respecto del alcanzable si existe.
- **Votos adicionales necesarios**, siempre identificados como requerimiento del objetivo solicitado.

Debajo, una frase de estado legible: «El objetivo se alcanza bajo estos supuestos» o «Con estas fuentes se llega a X%; faltan N votos para alcanzar Y%». El aviso debe incluir texto y no depender sólo del color. Con objetivo imposible, evitar que los votos requeridos parezcan votos obtenidos.

Una sección «Cómo se compone el cambio» explica transferencia y nuevos votos utilizados. Mostrar por separado los nuevos votos sin asignación; no incorporarlos como votos de otras fuerzas. Un gráfico de barras sencillo para observado, objetivo y alcanzable puede complementar los números, sin agregar una segunda lectura obligatoria.

La tabla actual pasa a «Ver comparación completa». Electores, denominador, votantes y votos restantes de la fuerza de origen quedan allí. Las reglas completas pasan a «Cómo funciona el modelo», conservando su contenido.

En móvil, una única columna. El resultado principal sigue inmediatamente a los controles. La navegación y el cierre permanecen accesibles sin cubrir campos al abrir el teclado.

### Vista «Explorar partidos»

Contexto compacto: fuerza, objetivo, resultado alcanzable y votos adicionales requeridos. Mensaje permanente: «Seleccionar partidos compara magnitudes; no distribuye votos ni recalcula el resultado provincial».

Selector «Lista / Gráfico». La lista incluye búsqueda por nombre, casillas y cantidad seleccionada; selecciona los mismos partidos que el gráfico, incluidos los que no se puedan representar por falta de métricas. No establecer prioridades automáticas.

El gráfico mantiene sus variables actuales. Simplificar su lectura mediante etiquetas directas y una leyenda de tamaños; no cambiar escalas ni variables en esta primera mejora. Selección normal por clic; el lazo se activa con un botón y muestra si reemplaza o agrega. El gesto táctil debe permitir desplazarse cuando el modo de lazo está desactivado.

Al seleccionar, mostrar únicamente:

1. Cantidad de partidos y peso sobre los votos positivos provinciales.
2. Votos positivos de la selección.
3. Votos adicionales del objetivo provincial / votos positivos de la selección.
4. Si aumenta la participación: nuevos votantes provinciales / abstenciones de la selección.

La tercera y cuarta relaciones pueden superar 100% y no representan probabilidades ni apoyo electoral disponible. Si el objetivo no es alcanzable, aclarar junto a ellas que usan el objetivo solicitado. Si el denominador es cero, mostrar «No se puede calcular» con el motivo. No usar una barra que se complete al 100%, un semáforo de viabilidad territorial ni una etiqueta de «potencial».

Con selección vacía, mostrar una instrucción y ocultar las tarjetas de agregados vacíos. «Más datos de la selección» contiene los indicadores restantes. «Ver N partidos en el Atlas» y «Limpiar selección» tienen alcances separados y visibles.

## Secuencia de implementación propuesta

1. **Claridad del resultado.** Tres resultados principales, estado inicial, mensaje de objetivo imposible, etiquetas y entrada numérica. Mantener la lógica de cálculo existente.
2. **Jerarquía y navegación.** Dos vistas, encabezado persistente, comparación y metodología desplegables, diseño móvil. Preservar el estado al cambiar vistas.
3. **Selección territorial.** Lista con búsqueda, modo de lazo explícito, deshacer, ficha breve y resumen reducido. Mantener el vínculo con los contornos del Atlas.
4. **Validación de uso.** Comprobar en navegador y con usuarios las tareas de abajo. Sólo después considerar ampliaciones del modelo o nuevas variables gráficas.

Las etapas 1 y 2 pueden desarrollarse principalmente en `simulator.mjs` y `simulator.css`; la etapa 3 en `simulator-territory.mjs` y estilos. Los modelos puros deben conservarse como referencia. Los tests de interfaz existentes necesitarán adaptarse a las vistas y al modo de selección explícito. La navegación de regreso desde el Atlas puede requerir cambios en la integración de `app.js`.

## Criterios de aceptación

- Un usuario identifica fuerza, elección base, observado, objetivo y alcanzable sin abrir la metodología.
- En un escenario imposible puede explicar qué se alcanza y cuánto falta, sin confundir objetivo con resultado.
- Puede introducir un porcentaje exacto con teclado; el resumen redondeado no modifica el valor observado exacto ni genera cambios ficticios al iniciar.
- Puede elegir un partido por nombre sin localizarlo en el gráfico.
- Entiende que seleccionar territorios no asigna votos y que el margen no es necesariamente el de la fuerza elegida.
- Puede cambiar de vista, consultar el Atlas y regresar conservando el escenario y la selección.
- Puede distinguir y utilizar restablecer parámetros, limpiar selección y deshacer selección.
- En 390 px de ancho puede configurar y leer el resultado sin scroll horizontal de la página; dispone de la lista para la selección territorial.
- Con teclado puede operar ambas vistas, seleccionar, quitar y cerrar sin perder el foco; los cambios de resultado se anuncian sin saturar las regiones accesibles.
- Los resultados del cálculo coinciden con el modelo actual para los mismos parámetros, incluidos objetivos imposibles, denominadores cero y relaciones territoriales mayores al 100%.

Prueba breve sugerida con usuarios: configurar un objetivo, explicar un caso imposible, seleccionar tres partidos por nombre y regresar desde el mapa. Registrar errores, pedidos de ayuda y la interpretación del resultado. No atribuir mejoras de tiempo o comprensión antes de ejecutar esta prueba.
