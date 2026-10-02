// Pure calculations. Observations are never modified.
export function latestElection(data) {
  const available = data.sources.filter(s => s.voter_total_available !== false && Object.keys(data.party.elections[s.id] || {}).length);
  const sorted = [...available].sort((a, b) => Number(b.year) - Number(a.year)
    || String(b.date || '').localeCompare(String(a.date || ''))
    || Number(b.id === data.defaults.target) - Number(a.id === data.defaults.target)
    || a.id.localeCompare(b.id));
  if (!sorted.length) throw new Error('No hay elecciones con datos provinciales.');
  return { source: sorted[0], ambiguous: available.filter(s => s.year === sorted[0].year).length > 1 && !sorted[0].date };
}

export function observe(row) {
  const { electores, votantes, positivos } = row;
  const forces = Object.entries(row.fuerzas).map(([name, votes]) => ({ name, votes }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'es'));
  if (![electores, votantes, positivos, ...forces.map(f => f.votes)].every(n => Number.isSafeInteger(n) && n >= 0)
    || !electores || !positivos || votantes > electores || positivos > votantes
    || forces.reduce((s, f) => s + f.votes, 0) !== positivos) {
    throw new Error('Los totales observados no permiten construir un escenario consistente.');
  }
  return Object.freeze({ electores, votantes, positivos, turnout: votantes / electores,
    forces: Object.freeze(forces.map(Object.freeze)) });
}

export function simulate(base, params) {
  const force = base.forces.find(f => f.name === params.force);
  if (!force) throw new Error('Seleccione una fuerza disponible.');
  const otherVotes = base.positivos - force.votes;
  const observedShare = force.votes / base.positivos;
  const share = params.share;
  const turnout = params.increase ? params.turnout : base.turnout;
  if (!Number.isFinite(share) || share < observedShare || share > 1
    || !Number.isFinite(turnout) || turnout < base.turnout || turnout > 1) throw new Error('Porcentaje fuera del rango permitido.');
  const voters = turnout === base.turnout ? base.votantes : Math.min(base.electores, Math.round(turnout * base.electores));
  const newcomers = voters - base.votantes;
  const denominator = base.positivos + newcomers;
  // The epsilon only removes floating-point noise at exact integer boundaries.
  const required = share === observedShare && !newcomers ? force.votes : Math.ceil(share * denominator - 1e-8);
  const additional = required - force.votes;
  const transferred = Math.min(additional, otherVotes);
  const fromNew = Math.min(additional - transferred, newcomers);
  const missing = additional - transferred - fromNew;
  const achieved = force.votes + transferred + fromNew;
  return { force, otherVotes, rank: 1 + base.forces.filter(f => f.votes > force.votes).length,
    observedShare, share, voters, turnout: voters / base.electores, newcomers, denominator,
    required, additional, transferred, fromNew, unassigned: newcomers - fromNew,
    remaining: otherVotes - transferred, missing, achieved,
    achievedShare: achieved / denominator, feasible: missing === 0 };
}
