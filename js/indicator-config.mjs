// Cambiar solamente esta constante para renombrar el indice en toda la interfaz.
export const ADN_NAME = 'Afinidad Socioelectoral';
export const ADN_LEGEND_LABEL = 'Afinidad';

// La clave tecnica es estable: no cambiarla al elegir el nombre definitivo.
export const ADN_ID = 'adn';
export const ADN_DESCRIPTION = `${ADN_NAME}: puntaje precalculado del Censo 2022, experimental, presentado como porcentaje (puntaje × 100) con un decimal. Referencia provincial fija; no es porcentaje de voto ni probabilidad individual.`;
export const ADN_FAMILY = {
  id: ADN_ID, dimension: 'indices_compuestos', label: ADN_NAME,
  shortName: ADN_NAME, codes: [ADN_ID],
};
export const ADN_PALETTE = ['#ffffd9', '#a1dab4', '#41b6c4', '#225ea8', '#081d58'];

export function formatIndex(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${new Intl.NumberFormat('es-AR', {minimumFractionDigits:1, maximumFractionDigits:1}).format(value * 100)} %`
    : 's/d';
}
