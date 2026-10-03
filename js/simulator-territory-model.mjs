export const TERRITORIAL_LEVELS = {
  party: { label: 'Partido', name: row => row.partido },
  locality: { label: 'Localidad', name: row => `${row.partido} · ${row.localidad}` },
  circuit: { label: 'Circuito', name: row => `${row.partido} · ${row.circuito}` },
};
export const ratio = (a, b) => b > 0 ? a / b : null;

export function territoryPoints(rows, force, unit = 'party') {
  return Object.entries(rows).map(([key, row]) => ({
    key, unit, name: TERRITORIAL_LEVELS[unit].name(row), row,
    positive: row.positivos, votes: row.fuerzas?.[force] || 0,
    share: ratio(row.fuerzas?.[force] || 0, row.positivos),
    competition: row.margen, electors: row.electores, voters: row.votantes,
    turnout: ratio(row.votantes, row.electores), abstentions: row.electores - row.votantes,
  }));
}

// Allocate once across the whole province. Largest remainders keep integers,
// preserve the provincial total, and make each party's amount independent of selection.
export function allocateNewVoters(points, base, scenario) {
  const count = scenario.newcomers;
  const provincialAbstentions = base.electores - base.votantes;
  if (!Number.isSafeInteger(count) || count < 0 || count > provincialAbstentions) throw new Error('Aumento de participación fuera de rango.');
  if (points.some(p => !Number.isSafeInteger(p.abstentions) || p.abstentions < 0)) throw new Error('Abstenciones territoriales inválidas.');
  if (points.reduce((sum,p) => sum + p.abstentions, 0) !== provincialAbstentions) throw new Error('La cobertura territorial no coincide con las abstenciones provinciales.');
  const allocation = points.map(p => {
    const exact = provincialAbstentions ? count * p.abstentions / provincialAbstentions : 0;
    return { key: p.key, capacity: p.abstentions, votes: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let pending = count - allocation.reduce((sum,p) => sum + p.votes, 0);
  allocation.sort((a,b) => b.remainder - a.remainder || a.key.localeCompare(b.key, 'es'));
  for (const p of allocation) if (pending > 0 && p.votes < p.capacity) { p.votes++; pending--; }
  if (pending) throw new Error('No se pudo distribuir el aumento provincial.');
  return new Map(allocation.map(p => [p.key, p.votes]));
}

export function circuitCoverage(parties, circuits) {
  const groups = new Map(Object.keys(parties).map(key => [key, []]));
  for (const [key,row] of Object.entries(circuits)) {
    if (!groups.has(row.partido_norm)) throw new Error(`Circuito ${key} sin partido válido.`);
    groups.get(row.partido_norm).push([key,row]);
  }
  for (const [key,party] of Object.entries(parties)) {
    const rows = groups.get(key).map(([,row])=>row);
    if (!rows.length) throw new Error(`No hay circuitos para ${party.partido}.`);
    for (const field of ['electores','votantes','positivos']) {
      if (rows.some(row => !Number.isSafeInteger(row[field])) || rows.reduce((sum,row)=>sum+row[field],0) !== party[field]) throw new Error(`Los circuitos no concilian con ${party.partido}: ${field}.`);
    }
    const forces = new Set([...Object.keys(party.fuerzas), ...rows.flatMap(row=>Object.keys(row.fuerzas))]);
    for (const force of forces) if (rows.reduce((sum,row)=>sum+(row.fuerzas[force]||0),0)!==(party.fuerzas[force]||0)) throw new Error(`Los votos por fuerza no concilian con ${party.partido}.`);
  }
  return groups;
}

export function allocateNewContribution(points, base, scenario) {
  const newcomers = allocateNewVoters(points,base,scenario);
  if (!scenario.repeatDistribution) return newcomers;
  return allocateNewVoters(points.map(p=>({...p,abstentions:newcomers.get(p.key)})),
    {electores:scenario.newcomers,votantes:0},{newcomers:scenario.newVotePotential});
}

// Preserve each party's integer quota when moving to its circuits. Selection never
// participates in allocation, so deselection cannot redistribute potential.
export function allocateCircuitNewVoters(parties, circuits, base, scenario) {
  const groups = circuitCoverage(parties,circuits);
  const partyAllocation = allocateNewVoters(territoryPoints(parties,scenario.force.name),base,scenario);
  const partyContribution = allocateNewContribution(territoryPoints(parties,scenario.force.name),base,scenario);
  const result = new Map();
  for (const [key,rows] of groups) {
    const allocation = allocateNewContribution(territoryPoints(Object.fromEntries(rows),scenario.force.name,'circuit'),parties[key],
      {newcomers:partyAllocation.get(key),repeatDistribution:scenario.repeatDistribution,newVotePotential:partyContribution.get(key)});
    allocation.forEach((value,circuit)=>result.set(circuit,value));
  }
  return result;
}

export function summarizeTerritories(points, selection, base, scenario, aggregateRows, fixedAllocation = null) {
  const chosen = points.filter(p => selection.has(p.key));
  const totals = aggregateRows(chosen.map(p => p.row));
  const margins = chosen.map(p => p.competition).filter(Number.isFinite).sort((a, b) => a - b);
  const mid = Math.floor(margins.length / 2);
  const votes = totals.fuerzas[scenario.force.name] || 0;
  const abstentions = totals.electores - totals.votantes;
  const allocation = fixedAllocation || allocateNewContribution(points, base, scenario);
  const otherVotes = totals.positivos - votes;
  const newVotes = chosen.reduce((sum,p) => sum + allocation.get(p.key), 0);
  const potential = otherVotes + newVotes;
  const gap = Math.max(0, scenario.additional - potential);
  const surplus = Math.max(0, potential - scenario.additional);
  return { count: chosen.length, ...totals, votes, abstentions, otherVotes, newVotes, potential, gap, surplus,
    coverage: ratio(potential, scenario.additional),
    captureRate: ratio(scenario.additional, potential),
    sufficient: gap === 0,
    share: ratio(votes, totals.positivos), turnout: ratio(totals.votantes, totals.electores),
    weight: ratio(totals.positivos, base.positivos),
    mean: margins.length ? margins.reduce((s, v) => s + v, 0) / margins.length : null,
    median: margins.length ? (margins[mid] + margins[Math.ceil(margins.length / 2) - 1]) / 2 : null,
    marginCount: margins.length,
    intensity: ratio(scenario.additional, totals.positivos),
    newcomerRatio: ratio(scenario.newcomers, abstentions),
  };
}

// Boundary points are included; selection uses point centres, not bubble edges.
export function insideLasso(point, polygon) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (Math.abs(cross) < 1e-7 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x)
      && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y)) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
