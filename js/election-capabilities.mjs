const DEFAULTS = {
  available_levels: ['party', 'locality', 'circuit'],
  available_metrics: ['participacion', 'ausentismo', 'competitividad', 'votos'],
  available_vote_types: ['positivo', 'blanco', 'nulo', 'impugnado', 'recurrido'],
  available_positive_measures: ['share_positive', 'share_total', 'gap_winner'],
};

export function commonCapabilities(data, ids, field) {
  const sources = [...new Set(ids.filter(Boolean))].map(id => data.sources.find(s => s.id === id));
  if (sources.some(s => !s)) return [];
  let values = DEFAULTS[field].filter(value => sources.every(s => (s[field] || DEFAULTS[field]).includes(value)));
  // White-vote shares with different denominators are not comparable.
  if (field === 'available_vote_types' && new Set(sources.map(s => s.vote_share_basis || 'all_cast')).size > 1) {
    values = values.filter(value => value === 'positivo');
  }
  return values;
}

export function commonLevels(data, ids) {
  return commonCapabilities(data, ids, 'available_levels');
}

export function difference(a, b) {
  return typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b) ? a - b : null;
}
