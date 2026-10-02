# Paneles ajustables y simulador

## Paneles

En escritorio (mas de 1180 px) los separadores entre los laterales y el mapa, y entre mapa y bloque inferior, permiten redistribuir espacio arrastrando. Doble clic o tecla Inicio en un separador restablece su dimension. Tambien se puede ajustar con flechas, con Shift para pasos mayores.

La distribucion se conserva en este navegador, en `localStorage`, clave `atlas-panel-layout-v1`. No modifica datos ni elecciones. Los tamanos relativos se adaptan a la ventana, con limites minimos. Atlas y el explorador del simulador comparten la distribucion. Leaflet actualiza su tamano y el grafico reutiliza su ResizeObserver.

En celular se mantiene el flujo vertical sin separadores. Las vistas especiales de cruce socioelectoral y continuidad conservan su propia estructura; los separadores se ocultan temporalmente y el ajuste reaparece al volver. La impresion no muestra separadores.

## Simulador

- Solo deslizadores para objetivo y participacion; sin cajas numericas.
- Valor visible con dos decimales. Flechas: 0,1 puntos porcentuales; Shift+flecha: 1 punto; Inicio/Fin: limites del rango. Se conserva el minimo exacto del resultado observado.
- Comparacion siempre abierta. Distribucion compacta verificada en 1366 x 768 con aumento de participacion activo. Pantallas pequenas y zoom alto conservan scroll para no reducir la legibilidad.
- Redaccion mas directa y aclaracion de que es una simulacion, no una prediccion. Modelo matematico sin cambios.

## Color

Mapa del simulador y puntos comparten `indexColor`, el puntaje por partido y el dominio provincial fijo de `data/adn.json`. El nombre procede de `ADN_NAME`, en `js/indicator-config.mjs`.

La seleccion cambia el contorno, no el relleno; los colores del indice permanecen estables. Las leyendas y tooltips muestran el nombre y puntaje. No hay nueva normalizacion ni uso del indice en los calculos de potencial. Ejes y tamanos de los puntos mantienen sus significados anteriores. Un valor ausente se representa en gris.

## Verificacion

`tools/test_panel_resize_ui.cjs`: arrastre de los tres bordes, persistencia al recargar, restablecimiento, ausencia de cajas numericas, teclado, comparacion visible, variedad de colores, igualdad entre mapa y puntos, seleccion sin cambio de relleno y comportamiento movil.

`tools/test_simulator_ui.cjs`: regresion actualizada para los deslizadores; seleccion, lazo, ampliacion, zoom, retorno al Atlas y movil. No se modifica el calculo de escenarios ni los datos fuente.
