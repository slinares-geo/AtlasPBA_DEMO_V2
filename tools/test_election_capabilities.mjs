import assert from 'node:assert/strict';
import fs from 'node:fs';
import {commonLevels, commonCapabilities, difference} from '../js/election-capabilities.mjs';
const data = JSON.parse(fs.readFileSync(new URL('../data/electoral_data.json', import.meta.url)));
const id = '2025_generales_legislatura_provincial_jepba_definitivo';
const legacy = data.defaults.target;
assert.deepEqual(commonLevels(data, [legacy]), ['party','locality','circuit']);
for (const ids of [[id], [id,legacy], [legacy,id]]) {
  assert.deepEqual(commonLevels(data, ids), ['party']);
  assert.deepEqual(commonCapabilities(data, ids, 'available_metrics'), ['competitividad','votos']);
}
assert.deepEqual(commonCapabilities(data, [id,legacy], 'available_vote_types'), ['positivo']);
assert.deepEqual(commonCapabilities(data, [id], 'available_vote_types'), ['positivo','blanco']);
assert.deepEqual(commonLevels(data, ['unknown']), []);
assert.equal(difference(null, .5), null);
assert.equal(difference(.5, undefined), null);
assert.equal(difference(.5, .25), .25);
assert.equal(Object.keys(data.party.elections[id]).length, 135);
assert.equal(Object.keys(data.circuit.elections[id]).length, 0);
assert.equal(Object.keys(data.locality.elections[id]).length, 0);
console.log('Election capabilities: OK');
