import {ADN_ID, ADN_NAME, ADN_DESCRIPTION, ADN_PALETTE} from './indicator-config.mjs';

export function indexValue(data, unit, key) {
  return data?.territories?.[unit]?.[key]?.adn ?? null;
}

export function indexColor(value, domain) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '#c6cdd0';
  const [lo, hi] = domain;
  const t = Math.max(0, Math.min(1, (value-lo)/(hi-lo))) * (ADN_PALETTE.length-1);
  const i = Math.min(ADN_PALETTE.length-2, Math.floor(t));
  const a = ADN_PALETTE[i].slice(1), b = ADN_PALETTE[i+1].slice(1);
  return '#' + [0,2,4].map(offset => Math.round(parseInt(a.slice(offset,offset+2),16) +
    (parseInt(b.slice(offset,offset+2),16)-parseInt(a.slice(offset,offset+2),16))*(t-i)).toString(16).padStart(2,'0')).join('');
}

// Attach an already computed value, never average, normalize or invert in the browser.
export function attachIndex(socio, index) {
  if (index.schema_version !== 1 || !index.metadata.version_indice) throw new Error('Invalid index contract');
  const variable = {
    id: ADN_ID, nombre_corto: ADN_NAME, descripcion: ADN_DESCRIPTION,
    grupo_tematico: 'Indices compuestos', unidad: 'puntaje', formato: 'index',
    metodo_agregacion: 'precalculado', agregable_en: ['party','locality','circuit'],
    anio: index.metadata.anio_censal, fuente: 'Censo 2022; indice experimental precalculado',
    universo: 'Territorios censales; referencia provincial fija de circuitos completos',
  };
  const territories = {...socio.territories};
  for (const unit of variable.agregable_en) {
    territories[unit] = {...territories[unit]};
    for (const [key, row] of Object.entries(index.territories[unit])) {
      const original = territories[unit][key] || {};
      territories[unit][key] = {...original, values:{...original.values, [ADN_ID]:row.adn}};
    }
  }
  return {...socio, metadata:{...socio.metadata, variables:[...socio.metadata.variables.filter(v=>v.id!==ADN_ID),variable]}, territories};
}
