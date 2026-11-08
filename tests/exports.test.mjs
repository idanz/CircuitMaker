import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeWorker,workerBundle,pythonAssets} from './helpers.mjs';
import {compareArtifacts} from '../src/compare.js';

test('mixed Blueprints, typed wires, aggregate exports and omitted devices stay aligned', {timeout:90000}, async t=>{
  const py=makeWorker(await workerBundle('python')),ts=makeWorker(await workerBundle('typescript'));
  const pythonImports='from circuit import Blueprint, Decider, Arithmetic, Constant, Device, Operation, WireColor, Port, wire\nfrom catalog import Virtual\n';
  const tsImports='import {Blueprint, Decider, Arithmetic, Constant, Device, Operation, WireColor, Port, wire} from "circuit"; import {Virtual} from "catalog";\n';
  async function run(p,s){
    py.post({type:'run',code:pythonImports+p});ts.post({type:'run',code:tsImports+s});
    const [a,b]=await Promise.all([py.wait(m=>['result','error'].includes(m.type)),ts.wait(m=>['result','error'].includes(m.type))]);
    assert.equal(a.type,'result',a.message);assert.equal(b.type,'result',b.message);
    assert.ok(compareArtifacts(a.artifacts,b.artifacts).matches,compareArtifacts(a.artifacts,b.artifacts).difference);
    assert.deepEqual(a.artifacts.map(({name,label,kind})=>({name,label,kind})),b.artifacts.map(({name,label,kind})=>({name,label,kind})));
    assert.equal(a.artifacts[0].kind,'all');assert.equal(a.artifacts[0].label,'All');
    for(const artifact of [...a.artifacts,...b.artifacts]){
      const bp=artifact.data.blueprint, ids=new Set(bp.entities.map(e=>e.entity_number));
      assert.ok(bp.entities.every(e=>['decider-combinator','arithmetic-combinator','constant-combinator'].includes(e.name)));
      for(const [id,,other]of bp.wires??[])assert.ok(ids.has(id)&&ids.has(other),'No dangling device or external references');
    }
    return a;
  }
  try{
    await Promise.all([py.wait(m=>m.type==='harness-loaded'),ts.wait(m=>m.type==='harness-loaded')]);
    py.post({type:'init',assets:await pythonAssets()});ts.post({type:'init'});
    for(const w of [py,ts]){const r=await w.wait(m=>m.type==='ready'||m.type==='error');assert.equal(r.type,'ready',r.message);}
    await t.test('mixed groups preserve internal wires and All deduplicates overlapping groups',async()=>{
      const r=await run(`seed=Constant('Seed',[Virtual.A.output(2)])
scale=Arithmetic('Scale',Virtual.A,Operation.MULTIPLY,3,Virtual.B)
gate=Decider('Gate',Virtual.B.greater_than(0),[Virtual.B.copy_input()])
wire(seed,scale,color=WireColor.RED)
wire(scale,gate,color=WireColor.GREEN)
wire(gate,gate,color=WireColor.RED)
mixed=Blueprint([seed,scale,gate],label='Mixed')
overlap=Blueprint([scale],label='Arithmetic slice')
assert len(mixed.entities)==3 and len(mixed.deciders)==1
try:
    mixed.entities=()
    raise AssertionError('Blueprint must be frozen')
except AttributeError:
    pass`, `const seed=new Constant({name:'Seed',outputs:[Virtual.A.output(2)]});
const scale=new Arithmetic({name:'Scale',left:Virtual.A,operation:Operation.MULTIPLY,right:3,output:Virtual.B});
const gate=new Decider({name:'Gate',when:Virtual.B.greaterThan(0),outputs:[Virtual.B.copyInput()]});
wire(seed,scale,{color:WireColor.RED}); wire(scale,gate,{color:WireColor.GREEN}); wire(gate,gate,{color:WireColor.RED});
const mixed=new Blueprint([seed,scale,gate],'Mixed'), overlap=new Blueprint([scale],'Arithmetic slice');
if(mixed.entities.length!==3||mixed.deciders.length!==1||!Object.isFrozen(mixed.entities))throw Error('Invalid frozen mixed group');`);
      assert.equal(r.artifacts[0].data.blueprint.entities.length,3);
      assert.deepEqual([...new Set(r.artifacts.filter(a=>a.data.blueprint.entities.length===1).map(a=>a.data.blueprint.entities[0].name))].sort(),['arithmetic-combinator','constant-combinator','decider-combinator']);
      assert.equal(r.artifacts.find(a=>a.name==='mixed').data.blueprint.wires.length,3);
      assert.ok(!r.artifacts.find(a=>a.name==='overlap').data.blueprint.wires);
    });
    await t.test('All includes wires across named group boundaries',async()=>{
      const r=await run(`a=Arithmetic('First',Virtual.A,Operation.ADD,1,Virtual.B)
b=Arithmetic('Second',Virtual.B,Operation.ADD,1,Virtual.C)
wire(a,b,color=WireColor.GREEN)
left=Blueprint([a])
right=Blueprint([b])`, `const a=new Arithmetic({name:'First',left:Virtual.A,operation:Operation.ADD,right:1,output:Virtual.B});
const b=new Arithmetic({name:'Second',left:Virtual.B,operation:Operation.ADD,right:1,output:Virtual.C});
wire(a,b,{color:WireColor.GREEN});const left=new Blueprint([a]),right=new Blueprint([b]);`);
      assert.equal(r.artifacts[0].data.blueprint.wires.length,1);
      assert.ok(r.artifacts.slice(1).every(a=>!a.data.blueprint.wires));
    });
    await t.test('omits all Device kinds and attached wires from every export',async()=>{
      const r=await run(`d=Decider('Memory',Virtual.A.greater_than(0),[Virtual.A.copy_input()])
lamp=Device('Lamp','small-lamp',Virtual.A.greater_than(0))
pump=Device('Pump','pump',Virtual.A.greater_than(0))
belt=Device('Belt','transport-belt')
for device in [lamp,pump,belt]:
    wire(d,device)
wire(d,d,color=WireColor.GREEN)
mixed=Blueprint([d,lamp,pump,belt])
only_devices=Blueprint([lamp,pump,belt])`, `const d=new Decider({name:'Memory',when:Virtual.A.greaterThan(0),outputs:[Virtual.A.copyInput()]});
const lamp=new Device({name:'Lamp',prototype:'small-lamp',when:Virtual.A.greaterThan(0)}),pump=new Device({name:'Pump',prototype:'pump',when:Virtual.A.greaterThan(0)}),belt=new Device({name:'Belt',prototype:'transport-belt'});
for(const device of [lamp,pump,belt])wire(d,device);wire(d,d,{color:WireColor.GREEN});
const mixed=new Blueprint([d,lamp,pump,belt]),only_devices=new Blueprint([lamp,pump,belt]);`);
      assert.equal(r.artifacts.length,2);assert.ok(r.logs.some(l=>l.includes('Omitted 3 Device')));
      for(const a of r.artifacts){assert.equal(a.data.blueprint.entities.length,1);assert.equal(a.data.blueprint.wires.length,1);}
    });
    await t.test('packs disconnected circuits without stretching their wires',async()=>{
      const r=await run(`seeds=[Constant(f'Seed {i}',[Virtual.A.output(i)]) for i in range(20)]
for i,seed in enumerate(seeds):
    stage=Arithmetic(f'Stage {i}',Virtual.A,Operation.ADD,1,Virtual.B)
    wire(seed,stage,color=WireColor.GREEN)`, `const seeds=Array.from({length:20},(_,i)=>new Constant({name:'Seed '+i,outputs:[Virtual.A.output(i)]}));
for(const [i,seed]of seeds.entries()){const stage=new Arithmetic({name:'Stage '+i,left:Virtual.A,operation:Operation.ADD,right:1,output:Virtual.B});wire(seed,stage,{color:WireColor.GREEN});}`);
      const bp=r.artifacts[0].data.blueprint;assert.equal(bp.entities.length,40);assert.equal(bp.wires.length,20);
      for(const [a,,b]of bp.wires){const p=bp.entities[a-1].position,q=bp.entities[b-1].position;assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<=9);}
    });
    await t.test('named All and legacy wire arguments remain usable',async()=>{
      const r=await run(`d=Decider('D',Virtual.A.greater_than(0),[Virtual.A.copy_input()])
wire(d,d,'green','output','input')
All=Blueprint(deciders=[d],label='Named All')`, `const d=new Decider({name:'D',when:Virtual.A.greaterThan(0),outputs:[Virtual.A.copyInput()]});wire(d,d,'green','output','input');const All=new Blueprint([d],'Named All');`);
      assert.equal(r.artifacts[1].name,'All');assert.equal(r.artifacts[1].label,'All (export)');
    });
  }finally{await Promise.allSettled([py.terminate(),ts.terminate()]);}
});
