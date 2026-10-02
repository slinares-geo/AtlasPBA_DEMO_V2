import assert from 'node:assert/strict';
import fs from 'node:fs';
import {attachIndex,indexValue,indexColor} from '../js/adn-model.mjs';
import {ADN_NAME, ADN_ID, formatIndex} from '../js/indicator-config.mjs';
const read = file=>JSON.parse(fs.readFileSync(new URL('../data/'+file,import.meta.url)));
const data=read('adn.json'), socio=read('socioeconomic_data.json');
const before=JSON.stringify(socio);
const joined=attachIndex(socio,data);
assert.equal(JSON.stringify(socio),before,'original socio data immutable');
assert.equal(joined.metadata.variables.find(v=>v.id===ADN_ID).nombre_corto,ADN_NAME);
for(const [unit,count,valid] of [['party',135,135],['locality',219,219],['circuit',1157,1149]]) {
  assert.equal(Object.keys(data.territories[unit]).length,count);
  assert.equal(Object.values(data.territories[unit]).filter(r=>r.adn!==null).length,valid);
  for(const [key,row] of Object.entries(data.territories[unit])) {
    assert.equal(indexValue(data,unit,key),row.adn);
    assert.equal(joined.territories[unit][key].values.adn,row.adn);
    if(row.adn!==null) assert.ok(Math.abs(Object.entries(row).filter(([k])=>k.endsWith('_aporte')).reduce((a,[k,v])=>a+v,0)-row.adn)<1e-11);
  }
}
assert.equal(indexValue(data,'circuit','128'),null);
assert.ok(data.territories.circuit['314_2']);
assert.ok(data.territories.circuit['622A']);
assert.ok(data.territories.locality['06518060']);
assert.ok(data.territories.party['06518']);
assert.equal(formatIndex(.425),'42,5 %');
assert.equal(formatIndex(0),'0,0 %');
assert.equal(formatIndex(1),'100,0 %');
assert.equal(formatIndex(.42567),'42,6 %');
assert.equal(formatIndex(null),'s/d');
assert.equal(indexColor(null,data.metadata.display_domain),'#c6cdd0');
assert.notEqual(indexColor(.42,data.metadata.display_domain),indexColor(.56,data.metadata.display_domain));
assert.deepEqual(attachIndex(joined,data),joined,'attachment is idempotent');
console.log('ADN: 1511 exact keys, 1503 precomputed scores, 8 nulls, immutability, idempotency and fixed palette OK');
