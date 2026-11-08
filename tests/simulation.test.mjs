import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arithmetic,simulateScenario} from '../src/simulation-engine.js';
import {makeWorker,workerBundle,pythonAssets} from './helpers.mjs';
const A={type:'virtual',name:'signal-A'},B={type:'virtual',name:'signal-B'},C={type:'virtual',name:'signal-C'};
const driver=(id,initial,events=[])=>({entity_number:id,name:'circuitmaker-driver',driver:{initial,events}});
const output=(signal,count)=>({signal,count});
const decider=id=>({entity_number:id,name:'decider-combinator',control_behavior:{decider_conditions:{conditions:[{first_signal:A,comparator:'>',constant:0}],outputs:[{signal:A,copy_count_from_input:true}]}}});
const math=(id,left,op,right,out)=>({entity_number:id,name:'arithmetic-combinator',control_behavior:{arithmetic_conditions:{first_signal:left,operation:op,second_constant:right,output_signal:out}}});
const plan=(entities,wires,ticks=6)=>({name:'Test',ticks,data:{blueprint:{entities,wires}}});
function value(result,tick,entity,name,quality='normal'){
 const index=result.timeline.signals.findIndex(s=>s.name===name&&s.quality===quality);
 return result.timeline.frames[tick].outputs[entity]?.[index]??0;
}

test('Driver pulses and feedback use simultaneous one-tick stages without changing prior snapshots',()=>{
 const result=simulateScenario(plan([decider(1),driver(2,[],[{tick:0,duration:1,signals:[output(A,1)]},{tick:4,duration:1,signals:[output(A,1)]}])],[[1,4,1,2],[2,2,1,2]],7));
 assert.deepEqual(Array.from({length:8},(_,t)=>value(result,t,1,'signal-A')),[0,1,1,1,1,2,2,2]);
 assert.deepEqual(Array.from({length:8},(_,t)=>value(result,t,2,'signal-A')),[1,0,0,0,1,0,0,0]);
 assert.equal(result.timeline.frames[0].conditions[1][0][0],true);
});

test('arithmetic chains are order independent and resets clear held signals',()=>{
 const entities=[driver(1,[output(A,3)],[{tick:3,signals:[],reset_others:true}]),math(2,A,'*',2,B),math(3,B,'+',1,C)],wires=[[1,1,2,1],[2,3,3,1]];
 const first=simulateScenario(plan(entities,wires)),reverse=simulateScenario(plan([...entities].reverse(),wires));
 assert.deepEqual(Array.from({length:7},(_,t)=>value(first,t,3,'signal-C')),[0,1,7,7,7,1,1]);
 assert.deepEqual(Array.from({length:7},(_,t)=>value(reverse,t,3,'signal-C')),[0,1,7,7,7,1,1]);
});

test('Driver updates retain omitted signals, clear explicit zeros, and reset in chronological order',()=>{
 const legendary={...A,quality:'legendary'};
 const events=[
  {tick:4,signals:[output(C,7)],reset_others:true},
  {tick:1,signals:[output(A,8)]},
  {tick:1,signals:[output(B,6)]},
  {tick:2,signals:[output(A,0)]},
  {tick:2,signals:[output(A,2)],duration:2},
  {tick:3,signals:[]},
  {tick:4,signals:[output(B,4)]},
  {tick:5,signals:[],reset_others:true},
 ];
 const result=simulateScenario(plan([driver(1,[output(A,3),output(B,5),output(legendary,9)],events)],[],6));
 assert.deepEqual(Array.from({length:7},(_,t)=>value(result,t,1,'signal-A')),[3,8,2,2,0,0,0]);
 assert.deepEqual(Array.from({length:7},(_,t)=>value(result,t,1,'signal-B')),[5,6,6,6,4,0,0]);
 assert.deepEqual(Array.from({length:7},(_,t)=>value(result,t,1,'signal-A','legendary')),[9,9,9,9,0,0,0]);
 assert.equal(value(result,4,1,'signal-C'),7);
 assert.equal(value(result,5,1,'signal-C'),0);
 assert.equal(value(result,0,1,'signal-A'),3,'later events leave initial snapshots intact');
 assert.throws(()=>simulateScenario(plan([driver(1,[],[{tick:0,signals:[],reset_others:1}])],[])),/reset_others/);
});

test('Driver update and reset flags work identically through both language APIs', {timeout:90000},async()=>{
 const python=`from circuit import Driver, Simulation
from catalog import Virtual
source=Driver('Updates', [Virtual.A.output(1), Virtual.B.output(5)])
source.at(2, [Virtual.B.output(0)])
source.at(1, [Virtual.A.output(2)])
source.at(3, [])
source.at(4, [Virtual.C.output(7)], reset_others=True)
source.at(5, [], reset_others=True)
Simulation([source], ticks=6)
try:
    source.at(0, [], reset_others=1)
except TypeError:
    pass
else:
    raise AssertionError('Invalid reset flag accepted')`;
 const typescript=`import {Driver,Simulation} from 'circuit';import {Virtual} from 'catalog';
const source=new Driver({name:'Updates',signals:[Virtual.A.output(1),Virtual.B.output(5)]});
source.at(2,[Virtual.B.output(0)]).at(1,[Virtual.A.output(2)]).at(3,[]).at(4,[Virtual.C.output(7)],true).at(5,[],true);
new Simulation({entities:[source],ticks:6});
let rejected=false;try{source.at(0,[],1 as any);}catch{rejected=true;}if(!rejected)throw new Error('Invalid reset flag accepted');`;
 const results=[];
 for(const [language,code]of [['python',python],['typescript',typescript]]){
  const worker=makeWorker(await workerBundle(language));
  try{
   await worker.wait(m=>m.type==='harness-loaded');
   worker.post({type:'init',...(language==='python'?{assets:await pythonAssets()}:{})});
   const ready=await worker.wait(m=>['ready','error'].includes(m.type));assert.equal(ready.type,'ready',ready.message);
   worker.post({type:'run',code});
   const result=await worker.wait(m=>['result','error'].includes(m.type));assert.equal(result.type,'result',result.message);
   results.push(result.simulations);
  }finally{await worker.terminate();}
 }
 assert.deepEqual(results[0],results[1]);
 const result=results[0][0];
 assert.deepEqual(Array.from({length:7},(_,t)=>value(result,t,1,'signal-A')),[1,2,2,2,0,0,0]);
 assert.deepEqual(Array.from({length:7},(_,t)=>value(result,t,1,'signal-B')),[5,5,0,0,0,0,0]);
 assert.equal(value(result,4,1,'signal-C'),7);
 assert.equal(value(result,5,1,'signal-C'),0);
});

test('networks sum once per emitter, keep colors and qualities separate, and apply every AND/OR condition',()=>{
 const gate=decider(3);gate.control_behavior.decider_conditions.conditions=[{first_signal:A,first_signal_networks:{red:true,green:false},comparator:'=',constant:3},{compare_type:'and',first_signal:B,comparator:'=',constant:4},{compare_type:'or',first_signal:C,comparator:'>',constant:10}];
 const result=simulateScenario(plan([driver(1,[output(A,3),output(B,4),output({...A,quality:'legendary'},9)]),driver(2,[output(A,-3)]),gate],[[1,1,3,1],[1,1,3,1],[2,2,3,2]]));
 assert.equal(result.timeline.frames[0].conditions[3][0].every(Boolean),true);
 assert.equal(value(result,1,3,'signal-A'),0,'red + green cancel');
 assert.equal(value(result,0,1,'signal-A','legendary'),9);
});

test('integer operations retain exact overflow, truncation and large modular powers',()=>{
 assert.equal(arithmetic(2147483647,'+',1),-2147483648);
 assert.equal(arithmetic(2147483647,'*',2147483647),1);
 assert.equal(arithmetic(-21,'/',10),-2);assert.equal(arithmetic(-13,'%',3),-1);
 assert.equal(arithmetic(3,'^',100),Number(BigInt.asIntN(32,3n**100n)));
 assert.equal(arithmetic(1,'/',0),0);assert.equal(arithmetic(-8,'>>',2),-2);
 assert.throws(()=>arithmetic(1,'<<',32),/shift counts/);
});

test('bounded timelines reject unsupported elements and ambiguous Anything output',()=>{
 assert.throws(()=>simulateScenario({...plan([driver(1,[])],[]),ticks:2001}),/ticks/);
 assert.throws(()=>simulateScenario(plan([{entity_number:1,name:'pump'}],[])),/Only/);
 const gate=decider(1);gate.control_behavior.decider_conditions.outputs[0].signal={type:'virtual',name:'signal-anything'};
 assert.throws(()=>simulateScenario(plan([gate,driver(2,[output(A,2),output(B,3)])],[[2,1,1,1]])),/Anything output/);
 const unique=simulateScenario(plan([gate,driver(2,[output(A,2)])],[[2,1,1,1]]));
 assert.equal(value(unique,1,1,'signal-A'),2);
 assert.equal(value(simulateScenario(plan([gate],[])),1,1,'signal-A'),0);
});

test('Each filters and reductions preserve channels, while Anything and Everything handle empty inputs',()=>{
 const each={type:'virtual',name:'signal-each'};
 const gate=decider(2);gate.control_behavior.decider_conditions.conditions[0].first_signal=each;
 gate.control_behavior.decider_conditions.outputs[0].signal=each;
 const reduce=math(3,each,'*',2,C);
 const result=simulateScenario(plan([driver(1,[output(A,3),output(B,-2)]),gate,reduce],[[1,1,2,1],[1,1,3,1]]));
 assert.equal(value(result,1,2,'signal-A'),3);assert.equal(value(result,1,2,'signal-B'),0);
 assert.equal(value(result,1,3,'signal-C'),2);
 for(const [kind,expected]of [['anything',0],['everything',1]]){
  const emptyGate=decider(1);emptyGate.control_behavior.decider_conditions.conditions[0].first_signal={type:'virtual',name:`signal-${kind}`};
  emptyGate.control_behavior.decider_conditions.outputs=[{signal:C,copy_count_from_input:false,constant:1}];
  assert.equal(value(simulateScenario(plan([emptyGate],[])),1,1,'signal-C'),expected);
 }
});

test('held changes sort by tick, same-tick updates are last declared, and overlapping pulses add',()=>{
 const events=[{tick:3,signals:[output(A,9)]},{tick:1,signals:[output(A,2)]},{tick:1,signals:[output(A,4)]},{tick:0,duration:2,signals:[output(A,1)]},{tick:1,duration:2,signals:[output(A,2)]}];
 const result=simulateScenario(plan([driver(1,[output(A,5)],events)],[],4));
 assert.deepEqual(Array.from({length:5},(_,tick)=>value(result,tick,1,'signal-A')),[6,7,6,9,9]);
});

test('Python and TypeScript Driver scenarios produce identical timelines and keep Drivers out of every blueprint', {timeout:90000},async()=>{
 const py=makeWorker(await workerBundle('python')),ts=makeWorker(await workerBundle('typescript'));
 const python=`from circuit import Decider, Driver, Simulation, wire, WireColor\nfrom catalog import Virtual\ncounter=Decider('Counter',Virtual.A.greater_than(0),[Virtual.A.copy_input()])\nsource=Driver('Pulse train').pulse(0,[Virtual.A.output(1)]).pulse(4,[Virtual.A.output(1)])\nwire(counter,counter,color=WireColor.GREEN)\nwire(source,counter,color=WireColor.GREEN)\nSimulation([counter,source],ticks=8,name='Counter test')`;
 const typescript=`import {Decider,Driver,Simulation,wire,WireColor} from 'circuit';import {Virtual} from 'catalog';const counter=new Decider({name:'Counter',when:Virtual.A.greaterThan(0),outputs:[Virtual.A.copyInput()]});const source=new Driver({name:'Pulse train'}).pulse(0,[Virtual.A.output(1)]).pulse(4,[Virtual.A.output(1)]);wire(counter,counter,{color:WireColor.GREEN});wire(source,counter,{color:WireColor.GREEN});new Simulation({entities:[counter,source],ticks:8,name:'Counter test'});`;
 try{
  await Promise.all([py.wait(m=>m.type==='harness-loaded'),ts.wait(m=>m.type==='harness-loaded')]);
  py.post({type:'init',assets:await pythonAssets()});ts.post({type:'init'});
  for(const w of [py,ts]){const r=await w.wait(m=>['ready','error'].includes(m.type));assert.equal(r.type,'ready',r.message);}
  py.post({type:'run',code:python});ts.post({type:'run',code:typescript});
  const [a,b]=await Promise.all([py.wait(m=>['result','error'].includes(m.type)),ts.wait(m=>['result','error'].includes(m.type))]);
  assert.equal(a.type,'result',a.message);assert.equal(b.type,'result',b.message);
  assert.deepEqual(a.simulations,b.simulations);
  assert.equal(value(a.simulations[0],8,1,'signal-A'),2);
  for(const result of [a,b])for(const artifact of result.artifacts){assert.ok(artifact.data.blueprint.entities.every(e=>e.name!=='circuitmaker-driver'));assert.ok((artifact.data.blueprint.wires??[]).every(([i,,j])=>i===1&&j===1));}
  py.post({type:'run',code:'from circuit import Decider\nfrom catalog import Virtual\nDecider("Clean",Virtual.A.greater_than(0),[Virtual.B.output(1)])'});
  const clean=await py.wait(m=>['result','error'].includes(m.type));assert.deepEqual(clean.simulations,[]);
 }finally{await py.terminate();await ts.terminate();}
});
