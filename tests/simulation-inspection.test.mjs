import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectionChannels,inspectSimulation} from '../src/simulation-inspection.js';
import {chartScale} from '../src/simulation-chart.js';
import {simulateScenario} from '../src/simulation-engine.js';

const A={type:'virtual',name:'signal-A'},legendary={type:'item',name:'iron-plate',quality:'legendary'};
const source=(entity_number,count)=>({entity_number,name:'circuitmaker-driver',driver:{initial:[{signal:A,count},{signal:legendary,count:9}],events:[{tick:2,signals:[],reset_others:true}]}});
const scenario=simulateScenario({name:'Merged bus',ticks:3,data:{blueprint:{entities:[source(1,3),source(2,-1)],wires:[[1,1,2,1]]}}});
const {timeline}=scenario,channels=inspectionChannels(timeline);
const context=tick=>({timeline,frame:timeline.frames[tick]});

test('diagram inspections separate emitted counts from summed network counts and preserve signal quality',()=>{
  const sections=inspectSimulation(context(0),channels,1);
  assert.deepEqual(sections.map(s=>s.title),['Emitted output','Red R1 · output']);
  assert.equal(sections[0].values.find(v=>v.signal.name==='signal-A').count,3);
  assert.equal(sections[1].values.find(v=>v.signal.name==='signal-A').count,2);
  assert.deepEqual(sections[1].values.find(v=>v.signal.name==='iron-plate'),{signal:legendary,count:18});
  assert.equal(sections[1].network,0);
});

test('port and wire inspections select the exact color and retain channels after counts become zero',()=>{
  const red=inspectSimulation(context(3),channels,1,{color:'red',port:'output'});
  assert.equal(red.length,1);assert.equal(red[0].title,'Red R1 · output');
  assert.deepEqual(red[0].values.map(v=>v.count),[0,0]);
  const green=inspectSimulation(context(0),channels,1,{color:'green',port:'output'});
  assert.equal(green.length,1);assert.notEqual(green[0].network,red[0].network);
  assert.equal(green[0].values.find(v=>v.signal.name==='signal-A').count,3);
  assert.deepEqual(inspectSimulation(context(0),channels,1,{color:'red',port:'input'}),[],'sources have no input port');
  assert.equal(inspectSimulation(context(0),channels,1).length,2,'unused source output mirrors stay out of entity summaries');
});

test('feedback network appears once in entity tooltip with both port roles',()=>{
  const timeline={networks:[{id:0,color:'green',connected:true,ports:[{entity:1,port:'input'},{entity:1,port:'output'}]}],signals:[A],frames:[{tick:0,networks:[{0:7}],outputs:{1:{0:4}}}]};
  const sections=inspectSimulation({timeline,frame:timeline.frames[0]},inspectionChannels(timeline),1);
  assert.equal(sections.length,2);assert.equal(sections[1].title,'Green G1 · input / output');
  assert.equal(sections[0].values[0].count,4);assert.equal(sections[1].values[0].count,7);
});

test('zero baseline stays correctly located for signed, positive, negative and empty chart ranges at narrow widths',()=>{
  for(const [min,max]of [[-6,8],[0,8],[-6,1],[0,1]]){
    const {x,y,zeroY}=chartScale(min,max,26,360);
    assert.equal(zeroY,y(0));assert.ok(zeroY>=y(max)&&zeroY<=y(min));
    assert.ok(y(1)<y(0),'positive values plot above zero');
    assert.ok(y(-1)>y(0),'negative values plot below zero');
    assert.equal(x(0),64);assert.equal(x(26),344);assert.equal(x(13),204);
  }
});
