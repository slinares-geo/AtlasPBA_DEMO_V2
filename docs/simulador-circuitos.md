# Seleccion por partidos y circuitos

El simulador permite seleccionar partidos y luego pulsar **Zoom a circuitos**.
El mapa encuadra los partidos elegidos; los demas quedan blancos. Los circuitos
usan su propio ADN, con la misma escala provincial y color que el grafico.
No se incorpora un paso por localidades.

Todos los circuitos con resultados de esos partidos quedan seleccionados al
entrar. Desmarcar desde la lista, el mapa o el grafico actualiza los totales sin
reconstruir las capas ni cambiar el centro o zoom. Volver a partidos recupera
los partidos iniciales. Reiniciar mapa vuelve a la provincia, borra la seleccion
y conserva fuerza, objetivo y participacion del escenario.

La base electoral actual contiene 135 partidos y 1047 circuitos. Se comprueba
que cada partido coincide exactamente con la suma de sus circuitos en electores,
votantes, positivos y votos de cada fuerza. Si no hay cobertura consistente,
el paso a circuitos se deshabilita con una explicacion.

Los nuevos votantes se distribuyen primero entre partidos y luego entre sus
circuitos mediante restos mayores. Asi se conservan los enteros y el potencial
del conjunto al cambiar de nivel. Desmarcar no redistribuye los nuevos votantes.
Las geometrías sin resultados se muestran diferenciadas, no se seleccionan ni
aportan potencial; los circuitos sin geometria se informan en el mapa.

Pruebas (Node; navegador requiere Playwright y Edge):

```powershell
node tools/test_simulator_circuits.mjs
node tools/test_simulator_circuits_ui.cjs
node tools/test_simulator_ui.cjs
```

La prueba de navegador usa Atlas servido en http://127.0.0.1:8765/ y verifica
seleccion inicial, contexto blanco, colores ADN, conservacion de totales,
estabilidad del encuadre y de las capas, vuelta a partidos y reinicio.
