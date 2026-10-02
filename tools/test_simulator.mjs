import assert from 'node:assert/strict';
import fs from 'node:fs';
import { latestElection, observe, simulate } from '../js/simulator-model.mjs';
const data = JSON.parse(fs.readFileSync(new URL('../data/electoral_data.json', import.meta.url)));
const source = latestElection(data).source;
assert.equal(Number(source.year), Math.max(...data.sources.map(s => Number(s.year))));
const aggregate = { electores: 0, votantes: 0, positivos: 0, fuerzas: {} };
for (const row of Object.values(data.party.elections[source.id])) {
  for (const key of ['electores', 'votantes', 'positivos']) aggregate[key] += row[key];
  for (const [name, votes] of Object.entries(row.fuerzas)) aggregate.fuerzas[name] = (aggregate.fuerzas[name] || 0) + votes;
}
const base = observe(aggregate);
const before = JSON.stringify(base);
let count = 0;
for (const force of base.forces) {
  const share = force.votes / base.positivos;
  const initial = simulate(base, { force: force.name, share, increase: false, turnout: base.turnout });
  assert.equal(initial.achieved, force.votes);
  assert.equal(initial.additional, 0);
  assert.equal(initial.achievedShare, share);
  for (const increase of [false, true]) for (const turnout of [base.turnout, (base.turnout + 1) / 2, 1]) for (const target of [share, (share + 1) / 2, 1]) {
    const r = simulate(base, { force: force.name, share: target, increase, turnout });
    assert.ok(r.remaining === null || r.remaining >= 0);
    assert.ok(r.transferred <= r.otherVotes);
    assert.ok(r.newcomers <= base.electores - base.votantes);
    assert.ok(r.voters <= base.electores);
    assert.equal(r.achieved + (base.positivos - force.votes - r.transferred) + r.unassigned, r.denominator);
    assert.equal(r.fromNew + r.unassigned, r.newcomers);
    assert.equal(r.additional, r.transferred + r.fromNew + r.missing);
    assert.equal(r.feasible, r.required === r.achieved);
    if (!increase) { assert.equal(r.denominator, base.positivos); assert.equal(r.fromNew, 0); }
    count++;
  }
}
assert.equal(JSON.stringify(base), before);
const tied = observe({ electores: 200, votantes: 100, positivos: 100, fuerzas: { B: 40, A: 40, C: 20 } });
assert.equal(simulate(tied, { force: 'C', share: .3, increase: false }).otherVotes, 80);
assert.equal(simulate(tied, { force: 'B', share: .5, increase: false }).feasible, true);
assert.equal(simulate(tied, { force: 'B', share: 1, increase: false }).transferred, 60);
assert.equal(simulate(tied, { force: 'C', share: 1, increase: true, turnout: 1 }).fromNew, 100);
assert.throws(() => simulate(base, { force: base.forces[0].name, share: 1.01, increase: false }));
assert.throws(() => simulate(base, { force: base.forces[0].name, share: 0, increase: false }));
assert.throws(() => simulate(base, { force: base.forces[0].name, share: 1, increase: true, turnout: 1.01 }));
const future = structuredClone(data);
future.sources.push({ id: 'future', year: '2030', label: 'Futura' });
future.party.elections.future = future.party.elections[source.id];
assert.equal(latestElection(future).source.id, 'future');
console.log(`OK: ${count} escenarios provinciales, identidad inicial, conservación, límites, empates, validaciones, inmutabilidad y elección dinámica.`);
