import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {inflateSync} from 'node:zlib';
import {root,makeWorker,workerBundle,pythonAssets} from './helpers.mjs';
import {compareArtifacts} from '../src/compare.js';
import {simulate} from './simulate.mjs';

test('all 31 cookbook recipes execute identically, encode valid wired blueprints and satisfy behavior checks', {timeout:90000}, async t=>{
 const recipes=JSON.parse(await readFile(path.join(root,'cookbook/manifest.json'),'utf8'));
 assert.equal(recipes.length,31);
 const py=makeWorker(await workerBundle('python')),ts=makeWorker(await workerBundle('typescript'));
 const built=new Map();
 try {
  await Promise.all([py.wait(m=>m.type==='harness-loaded'),ts.wait(m=>m.type==='harness-loaded')]);
  py.post({type:'init',assets:await pythonAssets()});ts.post({type:'init'});
  for(const worker of [py,ts]){const r=await worker.wait(m=>m.type==='ready'||m.type==='error');assert.equal(r.type,'ready',r.message);}
  for(const recipe of recipes)await t.test(recipe.id,async()=>{
   for(const [worker,ext] of [[py,'py'],[ts,'ts']]){
    const code=await readFile(path.join(root,`cookbook/${recipe.id}.${ext}`),'utf8');
    assert.match(code,/Source topic:/);assert.match(code,/scenario\.expect\(/);
    assert.ok(code.length>200);worker.post({type:'run',code});
   }
   const [p,s]=await Promise.all([py.wait(m=>['result','error'].includes(m.type)),ts.wait(m=>['result','error'].includes(m.type))]);
   assert.equal(p.type,'result',p.message);assert.equal(s.type,'result',s.message);
   assert.ok(compareArtifacts(p.artifacts,s.artifacts).matches,compareArtifacts(p.artifacts,s.artifacts).difference);
   assert.equal(p.simulations.length,1,'Every recipe has a runnable scenario');
   assert.deepEqual(p.simulations,s.simulations,'Python and TypeScript capture the same timeline');
   const simulation=p.simulations[0];
   assert.ok(simulation.timeline.frames.length>10);
   assert.ok(simulation.data.blueprint.entities.every(e=>e.name!=='pump'&&e.name!=='transport-belt'&&e.name!=='small-lamp'));
   checkScenario(recipe.id,simulation);
   assert.ok(p.artifacts.length>=2,'A connected recipe has All and selectable component/entity exports');
   assert.equal(p.artifacts[0].label,'All');
   for(const a of [...p.artifacts,...s.artifacts])assert.ok(a.data.blueprint.entities.every(e=>['decider-combinator','arithmetic-combinator','constant-combinator'].includes(e.name)),'Device placeholders must not be exported');
   if(['11-oil-pump','15-belt-counter','20-pulse'].includes(recipe.id))assert.ok(p.logs.some(l=>l.includes('Device placeholder')), 'Device omission must be explained');
   const artifact=p.artifacts[0],bp=artifact.data.blueprint;built.set(recipe.id,bp);
   assert.deepEqual(JSON.parse(inflateSync(Buffer.from(artifact.string.slice(1),'base64'))),artifact.data);
   const entities=new Map(bp.entities.map(e=>[e.entity_number,e]));
   for(const [i,p,j,q] of bp.wires??[]){
    assert.ok(entities.has(i)&&entities.has(j));assert.ok([1,2,3,4].includes(p)&&[1,2,3,4].includes(q));
    for(const [id,port] of [[i,p],[j,q]]) if(!['arithmetic-combinator','decider-combinator'].includes(entities.get(id).name))assert.ok(port<=2);
    const a=entities.get(i).position,b=entities.get(j).position;assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<=9,'Wire must fit circuit reach');
   }
   for(const e of bp.entities)if(e.name==='constant-combinator'){
    assert.ok(!e.control_behavior.filters);for(const f of e.control_behavior.sections.sections[0].filters){assert.equal(typeof f.name,'string');assert.equal(typeof f.count,'number');assert.ok(!f.signal);}
   }
   for(const e of bp.entities){assert.equal(e.position.x%1,.5);assert.equal(e.position.y%1,['constant-combinator','transport-belt','small-lamp'].includes(e.name)?.5:0);}
  });
  await t.test('clock periods, lookup values, filtering and feedback memory',()=>{
   const read=(id,n=20)=>{const sim=simulate(built.get(id));for(let i=0;i<n;i++)sim.tick();return sim;};
   const vector=read('28-vector-product');assert.equal(vector.network(7,3)['iron-plate'],24);assert.equal(vector.network(7,3)['copper-plate'],-6);
   const dictionary=read('29-dictionary');assert.equal(dictionary.network(7,3)['copper-plate'],17);assert.ok(!dictionary.network(7,3)['iron-plate']);
   const array=read('30-array');assert.equal(array.network(7,3)['express-transport-belt'],56);assert.equal(Object.keys(array.network(7,3)).length,1);
   for(const [id,period] of [['17-clock',30],['18-single-clock',60]]){
    const sim=simulate(built.get(id)),values=[];for(let i=0;i<period*3;i++){sim.tick();values.push(sim.network(1,3)['signal-C']??0);}
    assert.deepEqual(values.slice(period,period*2),values.slice(period*2));assert.equal(new Set(values.slice(period)).size,period);
   }
   for(const id of ['12-positive-memory','13-signed-memory']){const sim=simulate(built.get(id));sim.tick({entity:1,port:1,signals:{'signal-A':7}});for(let i=0;i<8;i++)sim.tick();assert.equal(sim.network(1,4)['signal-A'],7);sim.tick({entity:1,port:1,signals:{'signal-A':-7}});sim.tick();assert.ok(!sim.network(1,4)['signal-A']);}
   const cell=simulate(built.get('26-signed-cell'));cell.tick({entity:1,port:1,signals:{'signal-I':-8}});for(let i=0;i<12;i++)cell.tick();assert.equal(cell.network(3,3)['signal-M'],-8);cell.tick({entity:3,port:1,signals:{'signal-R':1}});for(let i=0;i<8;i++)cell.tick();assert.ok(!cell.network(3,3)['signal-M']);
   const latch=simulate(built.get('24-simple-latch'));latch.tick({entity:1,port:1,signals:{'signal-S':1}});for(let i=0;i<4;i++)latch.tick();assert.equal(latch.network(1,4)['signal-S'],1);latch.tick({entity:1,port:1,signals:{'signal-R':1}});latch.tick();assert.ok(!latch.network(1,4)['signal-S']);
   const once=read('19-once-clock',400);assert.equal(once.network(4,4)['signal-T'],181);
   for(const [previous,set,reset,expected] of [[0,0,0,0],[0,1,0,1],[0,0,1,0],[0,1,1,0],[1,0,0,1],[1,1,0,2],[1,0,1,0],[1,1,1,2]]){
    const sim=simulate(built.get('24-simple-latch'));if(previous)sim.tick({entity:1,port:1,signals:{'signal-S':1}});
    sim.tick({entity:1,port:1,signals:{'signal-S':set,'signal-R':reset}});assert.equal(sim.network(1,4)['signal-S']??0,expected);
   }
   const positive=simulate(built.get('25-positive-cell'));for(let i=0;i<6;i++)positive.tick({entity:1,port:1,signals:{'signal-I':9}});for(let i=0;i<8;i++)positive.tick();assert.equal(positive.network(3,1)['signal-M'],9);
   for(let i=0;i<4;i++)positive.tick({entity:1,port:1,signals:{'signal-I':-1}});for(let i=0;i<6;i++)positive.tick();assert.ok(!positive.network(3,1)['signal-M']);
  });
 } finally {await Promise.allSettled([py.terminate(),ts.terminate()]);}
});

function checkScenario(id,simulation){
 const {timeline}=simulation;
 const signalIndex=name=>timeline.signals.findIndex(s=>s.name===(name.length===1?`signal-${name}`:name));
 const out=(tick,entity,name)=>timeline.frames[tick].outputs[entity]?.[signalIndex(name)]??0;
 const net=(tick,entity,port,color,name)=>{
  const network=timeline.networks.find(n=>n.color===color&&n.ports.some(p=>p.entity===entity&&p.port===port));
  assert.ok(network);return timeline.frames[tick].networks[network.id][signalIndex(name)]??0;
 };
 const checks={
  '01-everything':[[1,1,'A',4],[9,1,'A',0],[17,1,'B',0]],
  '02-anything':[[1,1,'A',1],[9,1,'A',1],[17,1,'A',0]],
  '03-each-filter':[[1,1,'A',4],[9,1,'A',0],[9,1,'B',2]],
  '04-each-count':[[1,1,'A',2],[9,1,'A',1]],
  '05-each-sum':[[1,1,'A',6],[9,1,'A',2]],
  '06-arithmetic-map':[[1,1,'A',8],[9,1,'A',-6],[9,1,'B',4]],
  '07-arithmetic-sum':[[1,1,'A',12],[9,1,'A',-2]],
  '08-insulator':[[1,1,'A',4],[9,1,'A',-3],[17,1,'B',0]],
  '09-gate':[[1,1,'A',5],[9,1,'A',0],[17,1,'A',8]],
  '10-sr-bias':[[8,1,'S',1],[18,1,'S',1],[28,1,'S',0],[38,1,'S',1],[48,1,'S',0]],
  '11-oil-pump':[[8,1,'S',1],[18,1,'S',1],[28,1,'S',1],[38,1,'S',0],[48,1,'S',1],[58,1,'S',0]],
  '12-positive-memory':[[4,1,'A',7],[12,1,'A',4],[20,1,'A',0],[28,1,'A',5]],
  '13-signed-memory':[[4,1,'A',7],[12,1,'A',-3],[20,1,'A',0],[28,1,'A',-5]],
  '14-runaway-memory':[[10,1,'A',10],[30,1,'A',30]],
  '15-belt-counter':[[5,1,'iron-plate',2],[10,1,'copper-plate',3],[17,1,'iron-plate',6]],
  '16-arithmetic-clock':[[10,1,'C',10],[30,1,'C',30]],
  '17-clock':[[29,1,'C',29],[30,1,'C',0],[31,1,'C',1]],
  '18-single-clock':[[59,1,'C',59],[60,1,'C',0],[61,1,'C',1]],
  '19-once-clock':[[220,4,'T',181],[430,4,'T',181]],
  '20-pulse':[[30,3,'P',1],[31,3,'P',0],[60,3,'P',1],[90,3,'P',1]],
  '22-rising-edge':[[7,3,'P',1],[17,3,'P',0],[27,3,'P',1],[37,3,'P',0]],
  '23-event-counter':[[16,1,'N',3],[24,1,'N',8],[32,1,'N',6]],
  '24-simple-latch':[[4,1,'S',1],[15,1,'S',0],[24,1,'S',0],[32,1,'S',1],[41,1,'S',0]],
  '26-signed-cell':[[8,3,'M',-8],[18,3,'M',5],[28,3,'M',0],[36,3,'M',-3],[44,3,'M',0]],
  '27-scalar-product':[[1,1,'P',12],[9,1,'P',-10],[17,1,'P',0],[25,1,'P',-6]],
  '31-anything-output':[[3,1,'A',7],[11,1,'A',0],[19,1,'B',3],[27,1,'B',0]],
 };
 for(const [tick,entity,name,expected]of checks[id]??[])assert.equal(out(tick,entity,name),expected,`${id}: ${name} at tick ${tick}`);
 if(id==='19-once-clock')assert.ok(out(240,4,'T')<20,'reset restarts the stopped clock');
 if(id==='21-edge')for(const [tick,count]of [[6,1],[16,-1],[26,4],[36,-3]])assert.equal(net(tick,1,'output','green','A'),count);
 if(id==='25-positive-cell')for(const [tick,count]of [[14,9],[28,4],[42,0]])assert.equal(net(tick,3,'input','red','M'),count);
 if(id==='28-vector-product'){assert.equal(net(10,7,'output','red','iron-plate'),24);assert.equal(net(10,7,'output','red','copper-plate'),-6);}
 if(id==='29-dictionary'){assert.equal(net(10,7,'output','red','copper-plate'),17);assert.equal(net(10,7,'output','red','iron-plate'),0);}
 if(id==='30-array')for(const [tick,name,count]of [[6,'express-transport-belt',56],[14,'transport-belt',12],[22,'burner-inserter',78],[30,'burner-inserter',0],[38,'express-transport-belt',56]])assert.equal(net(tick,7,'output','red',name),count);
}
