import assert from 'node:assert/strict';
import fs from 'node:fs';
import {circuitCoverage, territoryPoints, allocateNewContribution, allocateCircuitNewVoters, summarizeTerritories} from '../js/simulator-territory-model.mjs';
import {latestElection,observe,simulate} from '../js/simulator-model.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../data/electoral_data.json',import.meta.url)));
const id=latestElection(data).source.id, parties=data.party.elections[id], circuits=data.circuit.elections[id];
const aggregate=rows=>rows.reduce((a,r)=>{
 for(const f of ['electores','votantes','positivos','blanco','nulo','impugnado','recurrido'])a[f]=(a[f]||0)+(r[f]||0);
 for(const [k,v] of Object.entries(r.fuerzas))a.fuerzas[k]=(a.fuerzas[k]||0)+v;
 return a;
},{electores:0,votantes:0,positivos:0,fuerzas:{}});
const base=observe(aggregate(Object.values(parties))), groups=circuitCoverage(parties,circuits);
assert.equal(groups.size,135);
assert.throws(()=>circuitCoverage(parties,{}));
for(const repeatDistribution of [false,true]) for(const turnout of [base.turnout,.8,1]) {
 const scenario=simulate(base,{force:base.forces[0].name,share:.65,increase:turnout>base.turnout,turnout,repeatDistribution});
 const pp=territoryPoints(parties,scenario.force.name), cp=territoryPoints(circuits,scenario.force.name,'circuit');
 const pa=allocateNewContribution(pp,base,scenario),ca=allocateCircuitNewVoters(parties,circuits,base,scenario);
 assert.equal([...ca.values()].reduce((a,b)=>a+b,0),scenario.newVotePotential);
 for(const [key,rows] of groups) {
  assert.equal(rows.reduce((s,[k])=>s+ca.get(k),0),pa.get(key));
  const keys=new Set(rows.map(([k])=>k)), subset=cp.filter(p=>keys.has(p.key));
  const p=summarizeTerritories(pp,new Set([key]),base,scenario,aggregate);
  const c=summarizeTerritories(subset,keys,base,scenario,aggregate,ca);
  for(const field of ['electores','votantes','positivos','votes','newVotes','otherVotes','potential'])assert.equal(c[field],p[field],key+'/'+field);
  const removed=subset[0];keys.delete(removed.key);
  const smaller=summarizeTerritories(subset,keys,base,scenario,aggregate,ca);
  assert.equal(smaller.newVotes,c.newVotes-ca.get(removed.key));
  assert.ok(smaller.potential<=c.potential);
 }
}
console.log('OK circuits: 135 reconciled parties, 1047 circuits, exact hierarchical allocation, no double counting, deselection does not redistribute.');
