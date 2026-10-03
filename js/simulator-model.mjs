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
  const nonPositive = Object.fromEntries(['blanco','nulo','impugnado','recurrido'].map(key=>[key,row[key]]));
  const repeatAvailable = Object.values(nonPositive).every(n=>Number.isSafeInteger(n) && n>=0)
    && Object.values(nonPositive).reduce((a,b)=>a+b,positivos) === votantes;
  return Object.freeze({ electores, votantes, positivos, nonPositive:Object.freeze(nonPositive), repeatAvailable, turnout: votantes / electores,
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
  const repeatDistribution = Boolean(params.increase && params.repeatDistribution);
  if (repeatDistribution && !base.repeatAvailable) throw new Error('La distribución de tipos de voto no concilia con los votantes.');
  const newByForce = {}, newByType = {};
  if (repeatDistribution) {
    const categories = [...base.forces.map(f=>({key:f.name,kind:'force',votes:f.votes})),
      ...Object.entries(base.nonPositive).map(([key,votes])=>({key,kind:'type',votes}))]
      .map(c=>{const exact=newcomers*c.votes/base.votantes;return {...c,count:Math.floor(exact),remainder:exact-Math.floor(exact)};});
    let pending = newcomers-categories.reduce((sum,c)=>sum+c.count,0);
    categories.sort((a,b)=>b.remainder-a.remainder || `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`,'es'));
    for (const c of categories) {
      if (pending>0) {c.count++;pending--;}
      (c.kind==='force' ? newByForce : newByType)[c.key]=c.count;
    }
  }
  const newPositives = repeatDistribution ? Object.values(newByForce).reduce((a,b)=>a+b,0) : newcomers;
  const newVotePotential = repeatDistribution ? newByForce[force.name] : newcomers;
  const denominator = base.positivos + newPositives;
  // The epsilon only removes floating-point noise at exact integer boundaries.
  const required = share === observedShare && !newcomers ? force.votes : Math.ceil(share * denominator - 1e-8);
  const additional = required - force.votes;
  const transferred = Math.min(Math.max(0,additional-(repeatDistribution ? newVotePotential : 0)), otherVotes);
  const fromNew = repeatDistribution ? newVotePotential : Math.min(additional - transferred, newcomers);
  const missing = Math.max(0,additional - transferred - fromNew);
  const achieved = force.votes + transferred + fromNew;
  return { force, otherVotes, rank: 1 + base.forces.filter(f => f.votes > force.votes).length,
    observedShare, share, voters, turnout: voters / base.electores, newcomers, denominator,
    repeatDistribution, newByForce, newByType, newPositives, newVotePotential,
    required, additional, transferred, fromNew, unassigned: repeatDistribution ? 0 : newcomers - fromNew,
    remaining: otherVotes - transferred + (repeatDistribution ? newPositives-fromNew : 0), missing, achieved,
    achievedShare: achieved / denominator, feasible: missing === 0 };
}
