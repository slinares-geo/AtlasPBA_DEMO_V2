# Documentación metodológica

## Objetivo de la aplicación

Atlas Electoral PBA permite explorar territorialmente resultados electorales de la Provincia de Buenos Aires. Su objetivo es facilitar lecturas comparativas entre elecciones, detectar patrones de participación, ausentismo, composición del voto y desempeño relativo de fuerzas políticas en distintas escalas territoriales.

La herramienta esta orientada a la exploracion analítica. No reemplaza la validación estadistica ni la revisión documental de las fuentes originales.

## Alcance territorial

El alcance territorial es la Provincia de Buenos Aires. La aplicación integra información electoral y cartográfica para representar resultados en el territorio provincial.

## Unidades de analisis

### Partido

La vista Partido agrega o representa información a nivel municipal. Permite leer patrones generales, comparar desempeños entre partidos y ubicar territorios de mayor peso electoral.

### Circuito electoral

La vista Circuito trabaja con una unidad territorial electoral mas detallada. Permite identificar heterogeneidad interna dentro de los partidos y observar variaciones que pueden quedar ocultas en la agregacion municipal.

## Fuentes de datos

1. DINE / resultados electorales: <https://www.argentina.gob.ar/dine/resultados-electorales>
2. Cartografía de partidos de Provincia de Buenos Aires desde datos abiertos: <https://portalgeoestadistico.indec.gob.ar/>
3. Cartografía digital de Circuitos Electorales de Buenos Aires | Cámara Nacional Electoral:
<https://mapa2.electoral.gov.ar/descargas/>

La aplicación integra datos electorales y cartográficos. Los resultados electorales se procesan para construir indicadores por unidad territorial y las capas cartográficas permiten representarlos espacialmente.

## Metricas principales

### Electores

Cantidad de personas habilitadas para votar en la unidad territorial correspondiente.

### Votantes

Cantidad de electores que emitieron voto.

### Participacion

Proporción de votantes sobre electores habilitados.

### Ausentismo

Proporción de electores habilitados que no emitieron voto. Se interpreta como complemento de la participación.

### Voto positivo

Votos afirmativos emitidos a fuerzas o listas participantes, expresados sobre el universo correspondiente segun el indicador seleccionado.

### Voto blanco

Votos emitidos sin seleccion de una opcion afirmativa.

### Voto nulo

Votos invalidados de acuerdo con los criterios electorales aplicables.

### Voto recurrido

Votos cuya validez fue objetada y queda sujeta a revisión segun el procedimiento electoral.

### Voto impugnado

Votos asociados a una impugnación de identidad u otra situacion prevista por la normativa electoral.

### Distribución de votos positivos por fuerza

Composicion de los votos afirmativos segun fuerza politica. La aplicación permite observar el porcentaje de cada fuerza sobre votos positivos y, cuando corresponde, sobre el total emitido.

### Competitividad

Diferencia entre la primera y la segunda fuerza sobre votos positivos. Valores mas bajos indican mayor competencia electoral entre las dos fuerzas principales.

### Distancia a primera fuerza

Mide la distancia entre la fuerza seleccionada y la primera fuerza en cada territorio. Si la fuerza seleccionada ya es primera fuerza, ese territorio se excluye de esta lectura. En el mapa esos casos quedan como sin dato o neutros para evitar interpretar como brecha una situacion en la que la fuerza ya lidera.

### Variaciones entre elecciones

Cambios entre una eleccion base y una eleccion comparada. Las variaciones se expresan principalmente en puntos porcentuales.

## Criterios de comparacion temporal

La comparacion temporal toma una eleccion base y una eleccion objetivo. Para cada metrica comparable, la aplicacion calcula la diferencia entre ambos momentos en la misma unidad territorial.

La lectura debe considerar que:

- los cargos, alianzas o denominaciones de fuerzas pueden variar entre elecciones;
- los cambios territoriales se interpretan mejor junto con volumen de electores y participación;
- una variación porcentual pequeña puede ser relevante en territorios de gran peso electoral;
- una variación grande en territorios pequeños requiere cautela analítica.

## Criterio de ranking

El ranking ordena territorios segun la metrica activa y el modo de analisis. Puede ordenar de mayor a menor, de menor a mayor o por intensidad absoluta del cambio, segun la pregunta o indicador seleccionado.

El ranking es una herramienta de priorizacion exploratoria. No implica causalidad ni jerarquía politica por fuera de la métrica elegida.

## Vista Partido/Localidad/Circuito

La vista Partido permite una lectura agregada y comparable entre municipios. La vista Localidad suma los circuitos según su CLC principal derivado desde radios censales y los representa mediante sus polígonos de circuito; no se construyen polígonos nuevos. La vista Circuito permite una lectura mas fina y localizada. Cambiar de vista modifica la unidad de calculo, el mapa, el ranking y la interpretacion territorial de los indicadores.

## Como leer el atlas

1. Seleccionar si se desea analizar una elección o comparar dos elecciones.
2. Elegir la elección objetivo y, si corresponde, la eleccion base.
3. Definir que indicador mostrar en el mapa.
4. Si se analiza voto por fuerza o tipo de voto, ajustar los controles dependientes.
5. Alternar entre Partido, Localidad y Circuito segun el nivel de detalle requerido.
6. Usar el mapa para ubicar patrones territoriales y el ranking para priorizar casos.
7. Revisar KPIs, composicion del voto y lectura rapida para contextualizar.
8. Usar el asistente para activar preguntas analiticas frecuentes.
9. Interpretar los resultados como indicios exploratorios y contrastarlos con fuentes y conocimiento territorial.

## Limitaciones

- La aplicación depende de la disponibilidad, consistencia y actualización de las fuentes utilizadas.
- Pueden existir diferencias entre unidades cartográficas y unidades electorales.
- La lectura a nivel de circuito requiere validacion de correspondencias entre datos electorales y geometria.
- Los indicadores tienen un uso exploratorio y no explican por si mismos las causas de los cambios observados.
- Las comparaciones entre elecciones deben considerar cambios de oferta electoral, alianzas, cargos y contexto politico.

## Recomendaciones de interpretación

- Combinar porcentajes con volumen de electores.
- Revisar participación y ausentismo antes de interpretar cambios de voto.
- Comparar patrones entre Partido, Localidad y Circuito para distinguir tendencias agregadas de heterogeneidad interna.
- Usar la distancia a primera fuerza solo en territorios donde la fuerza seleccionada no lidera.
- Tratar los territorios sin dato como casos a revisar, no como evidencia sustantiva.

## Continuidad y alternancia electoral

La clasificación utiliza dos o más elecciones seleccionadas y analiza al peronismo/K. La lista se construye desde los metadatos electorales, conserva elecciones diferentes del mismo año y se recalcula sin botón de aplicación. Para cada territorio se identifica si el peronismo gana siempre, pierde siempre, alterna entre victorias y derrotas, participa de un empate en el primer puesto o tiene datos incompletos. Un faltante nunca se interpreta como derrota. La categoría de empate solo se aplica cuando el peronismo integra el empate por el primer puesto; los ganadores se determinan con los votos agregados originales, no con porcentajes redondeados.

El detalle territorial presenta, para cada elección seleccionada, la distribución completa de votos positivos entre las fuerzas efectivamente participantes. Los porcentajes se calculan después de agregar votos absolutos del territorio y cada barra cierra en 100 % salvo redondeo. La clasificación continúa dependiendo de si el peronismo resulta ganador; no se usa esa clasificación para reemplazar los nombres históricos de las fuerzas.

## Indicadores socioeconómicos y cruces

El consolidado final contiene 79 indicadores relativos del Censo Nacional de Población, Hogares y Viviendas 2022 y una variable derivada de población total. Los cuatro grupos de edad son mutuamente excluyentes y exhaustivos y su suma coincide exactamente con Totaledad. El diccionario declara para cada variable nombre, descripción, fuente, año, universo, unidad y método de agregación. Las proporciones se calculan como ratio de sumas —suma de numeradores dividida por suma de denominadores— y no como promedio simple de porcentajes.

El enlace territorial parte del radio censal. Los circuitos se obtienen de la correspondencia radio–circuito; las localidades, directamente del CLC radio–localidad; y los partidos, del código territorial del radio. Los cruces excluyen observaciones incompletas, requieren al menos tres casos y muestran el coeficiente r de Pearson y R². Son asociaciones exploratorias y no implican causalidad.

Cada fila de ranking y la tabla de cruces permiten abrir una ficha socioeconómica del territorio. El resumen usa cuatro indicadores configurados de forma centralizada: población total, desocupación, NBI por vivienda inconveniente y ausencia de cobertura de salud. Los gráficos iniciales agrupan categorías por familia conceptual y consumen los agregados precalculados; el explorador separa dimensión e indicador y conserva la definición completa en el detalle metodológico.

Las matrices completas permiten auditar 14 distribuciones exhaustivas: grupos de edad, migración, clima educativo clasificable, acceso digital, NBI de vivienda, cobertura de salud, jubilación, actividad, categoría y rama ocupacional, tipo y tenencia de vivienda, hacinamiento y calidad de materiales. Cada distribución cierra en 100 % dentro de 0,01 puntos porcentuales. Clima educativo usa como denominador los hogares clasificables; los casos No corresponde, faltantes y no aplicables se conservan en el control de fuente, pero no se mezclan con la distribución sustantiva.

## Calidad y limitaciones de la correspondencia radio-circuito

La tabla operativa `Circuitos_Radios_uno_a_muchos.xlsx` asigna cada radio a un circuito mediante el centroide del radio y se considera provisional hasta su corrección. Se conservan cuatro asignaciones interpartidarias conocidas: radios 067600613, 067601310 y 067601311 al circuito 668A, y radio 067001004 al circuito 954. Los circuitos 128, 313, 338B y 548 no tienen radios censales asociados y permanecen sin indicadores; no se imputan valores.

La fuente radio–localidad contiene 19.967 radios con CLC urbano y 3.913 con CLC nulo: una cobertura de 83,61% del universo de 23.880 radios. Los nulos corresponden al territorio fuera de las localidades censales de más de 2.000 habitantes. Para resultados electorales, un circuito con un solo CLC se asigna directamente; si contiene varios, se elige como principal el de mayor población 2022. Una participación de al menos 70% se clasifica con confianza alta y entre 55% y 69,99% con confianza media. Las relaciones secundarias se conservan completas para el mapa flotante, pero no reciben una fracción de votos porque los resultados no están disponibles por radio.

La vista Localidad utiliza los 219 polígonos oficiales normalizados por CLC. Las 13 localidades sin circuito principal permanecen visibles y muestran sus circuitos compartidos con una advertencia explícita sobre la asignación única de votos. En la salida web se reparan dos bucles geométricos degenerados comprobados —CLC 06644010 y circuito 19— sin modificar las fuentes originales.
