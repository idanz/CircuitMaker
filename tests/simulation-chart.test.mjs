import {test} from 'node:test';
import assert from 'node:assert/strict';
import {graphTraces,networkChannels,signalLabel,describeNetworks,visibleSimulationNetworks,defaultGraphSelection,MAX_GRAPH_TRACES} from '../src/simulation-chart.js';
import {simulateScenario} from '../src/simulation-engine.js';

const timeline={
 signals:[{name:'signal-A',quality:'normal'},{name:'signal-B',quality:'legendary'}],
 networks:[{id:0,color:'green'},{id:1,color:'red'}],
 frames:[{networks:[{0:2},{1:-4}]},{networks:[{0:5,1:3},{0:1}]}],
};
test('multiple networks and signals retain separate traces, missing zeros, shared range and captured values',()=>{
 const original=JSON.stringify(timeline);
 const graph=graphTraces(timeline,new Set([0,1]),new Set([0,1]));
 assert.deepEqual(graph.traces.map(t=>t.values),[[2,5],[0,3],[0,1],[-4,0]]);
 assert.deepEqual([graph.min,graph.max],[-4,5]);
 assert.equal(graph.traces[0].color,graph.traces[2].color,'same signal keeps its color across networks');
 assert.notEqual(graph.traces[0].dash,graph.traces[2].dash);
 assert.equal(graph.traces[3].label,'R2 · B [legendary]');
 assert.equal(JSON.stringify(timeline),original,'graph selection does not mutate the timeline');
 assert.equal(signalLabel({name:'signal-A'}),'A');
 assert.equal(signalLabel({type:'item',name:'iron-plate'}),'Iron plate');
});

test('memory networks identify the Driver, named feedback and unconnected output mirrors; defaults compare input and memory',()=>{
 const data={blueprint:{description:'1: Positive feedback memory\n2: pulses',entities:[{entity_number:1,name:'decider-combinator'},{entity_number:2,name:'circuitmaker-driver'}]}};
 const networks=[
  {id:0,color:'red',connected:true,ports:[{entity:1,port:'input'},{entity:2,port:'output'}]},
  {id:1,color:'green',connected:true,ports:[{entity:1,port:'input'},{entity:1,port:'output'}]},
  {id:2,color:'red',connected:false,ports:[{entity:1,port:'output'}]},
  {id:3,color:'green',connected:false,ports:[{entity:2,port:'output'}]},
 ];
 const descriptions=describeNetworks(data,{networks});
 assert.equal(descriptions.get(0).title,'pulses → Positive feedback memory');
 assert.equal(descriptions.get(0).role,'Injected signals');
 assert.equal(descriptions.get(1).title,'Positive feedback memory · feedback');
 assert.equal(descriptions.get(1).role,'Feedback / output');
 assert.match(descriptions.get(1).endpoints,/Positive feedback memory \(#1\) output/);
 assert.equal(descriptions.get(2).detail,'Unwired output port');
 assert.deepEqual(visibleSimulationNetworks(networks,descriptions,networks.map(()=>new Set([0]))).map(n=>n.id),[0,1,2]);
 const selection=defaultGraphSelection(networks,descriptions,networks.map(()=>new Set([0])));
 assert.deepEqual([...selection.networks],[0,1]);assert.deepEqual([...selection.signals],[0]);
});

test('Everything example defaults to actual calculated output, never the unused green Driver port',()=>{
 const A={type:'virtual',name:'signal-A'},B={type:'virtual',name:'signal-B'},everything={type:'virtual',name:'signal-everything'};
 const data={blueprint:{description:'1: Everything wildcard\n2: inputs',entities:[
  {entity_number:1,name:'decider-combinator',control_behavior:{decider_conditions:{conditions:[{first_signal:everything,comparator:'>',constant:0}],outputs:[{signal:everything,copy_count_from_input:true}]}}},
  {entity_number:2,name:'circuitmaker-driver',driver:{initial:[{signal:A,count:4},{signal:B,count:2}],events:[{tick:4,signals:[{signal:A,count:-3},{signal:B,count:2}]}]}},
 ],wires:[[2,1,1,1]]}};
 const {timeline}=simulateScenario({data,ticks:8,name:'Everything'}),descriptions=describeNetworks(data,timeline),channels=networkChannels(timeline);
 const visible=visibleSimulationNetworks(timeline.networks,descriptions,channels),selection=defaultGraphSelection(timeline.networks,descriptions,channels);
 assert.equal(visible.filter(n=>descriptions.get(n.id).hasDriver).length,1);
 assert.ok(visible.filter(n=>descriptions.get(n.id).hasDriver).every(n=>n.connected));
 const selected=[...selection.networks].map(id=>descriptions.get(id));
 assert.deepEqual(selected.map(n=>n.role),['Injected signals','Circuit output']);
 assert.equal(selected[1].hasDriver,false);
 const signal=timeline.signals.findIndex(s=>s.name==='signal-A');
 assert.equal(timeline.frames[4].networks[selected[0].id][signal],-3);
 assert.equal(timeline.frames[4].networks[selected[1].id][signal],4);
 assert.equal(timeline.frames[5].networks[selected[1].id][signal]??0,0,'the actual output closes when a negative signal arrives');
});

test('both Driver colors stay visible when both are wired; disconnected Driver-only ports are hidden',()=>{
 const data={blueprint:{entities:[{entity_number:1,name:'decider-combinator'},{entity_number:2,name:'decider-combinator'},{entity_number:3,name:'circuitmaker-driver'},{entity_number:4,name:'circuitmaker-driver'}]}};
 const networks=[{id:0,color:'red',connected:true,ports:[{entity:3,port:'output'},{entity:1,port:'input'}]},{id:1,color:'green',connected:true,ports:[{entity:3,port:'output'},{entity:2,port:'input'}]},{id:2,color:'green',connected:false,ports:[{entity:4,port:'output'}]}];
 const descriptions=describeNetworks(data,{networks}),channels=networks.map(()=>new Set([0]));
 assert.deepEqual(visibleSimulationNetworks(networks,descriptions,channels).map(n=>n.id),[0,1]);
 assert.ok([0,1].every(id=>descriptions.get(id).role==='Injected signals'));
 assert.equal(defaultGraphSelection([networks[2]],descriptions,channels).networks.size,0);
});

test('a gate that renames A to B defaults to its B output rather than a missing A output trace',()=>{
 const networks=[{id:0,connected:true,ports:[{entity:2,port:'output'},{entity:1,port:'input'}],color:'red'},{id:1,connected:false,ports:[{entity:1,port:'output'}],color:'green'}];
 const data={blueprint:{entities:[{entity_number:1,name:'decider-combinator'},{entity_number:2,name:'circuitmaker-driver'}]}};
 const selection=defaultGraphSelection(networks,describeNetworks(data,{networks}),[new Set([0]),new Set([1])]);
 assert.deepEqual([...selection.networks],[1]);assert.deepEqual([...selection.signals],[1]);
});
test('channel discovery includes signals that only appear later and stays scoped per network',()=>{
 assert.deepEqual(networkChannels(timeline).map(s=>[...s].sort()),[[0,1],[0,1]]);
 assert.deepEqual(networkChannels({...timeline,frames:[timeline.frames[0]]}).map(s=>[...s]),[[0],[1]]);
});
test('empty selections and oversized cross-products remain bounded',()=>{
 assert.deepEqual(graphTraces(timeline,new Set(),new Set([0])).traces,[]);
 const oversized=graphTraces(timeline,new Set(Array.from({length:MAX_GRAPH_TRACES+1},(_,i)=>i)),new Set([0]));
 assert.equal(oversized.limited,true);assert.deepEqual(oversized.traces,[]);
});
