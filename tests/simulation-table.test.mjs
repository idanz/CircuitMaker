import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tickPage,tableColumns,TICKS_PER_PAGE} from '../src/simulation-table.js';
import {graphTraces} from '../src/simulation-chart.js';

test('table omits cross-product pairs that never occur on their network while preserving zeros within active columns',()=>{
 const timeline={signals:[{name:'signal-A'},{name:'signal-B'}],networks:[{id:0,color:'red'},{id:1,color:'green'}],frames:[{networks:[{0:4},{}]},{networks:[{},{1:-2}]},{networks:[{},{}]}]};
 const graph=graphTraces(timeline,new Set([0,1]),new Set([0,1]));
 assert.equal(graph.traces.length,4,'graph still honors all explicitly selected pairs');
 const columns=tableColumns(graph.traces);
 assert.deepEqual(columns.map(c=>[c.network,c.signal]),[[0,0],[1,1]]);
 assert.deepEqual(columns.map(c=>c.values),[[4,0,0],[0,-2,0]]);
 assert.equal(graph.traces.length,4,'table filtering leaves graph selection intact');
});

test('a signal that first appears on the final page remains a column on all earlier pages',()=>{
 const late={network:0,signal:1,values:Array(2001).fill(0)};late.values[2000]=7;
 const zero={network:1,signal:1,values:Array(2001).fill(0)};
 assert.deepEqual(tableColumns([zero,late]),[late]);
 assert.equal(tableColumns([zero]).length,0);
 assert.equal(late.values[0],0);assert.equal(late.values[2000],7);
});

test('table paging covers every captured tick once, including boundary and final frames',()=>{
 for(const lastTick of [1,34,99,100,199,430,2000]){
  const ticks=[];
  for(let start=0;start<=lastTick;start+=TICKS_PER_PAGE){
   const page=tickPage(lastTick,start);
   assert.ok(page.last-page.first<TICKS_PER_PAGE);
   for(let tick=page.first;tick<=page.last;tick++)ticks.push(tick);
  }
  assert.deepEqual(ticks,Array.from({length:lastTick+1},(_,i)=>i));
  assert.equal(tickPage(lastTick,lastTick).last,lastTick);
 }
});
test('seek and playback share a bounded page containing the selected tick',()=>{
 assert.deepEqual(tickPage(2000,2000),{page:20,first:2000,last:2000,pages:21});
 assert.equal(tickPage(430,99).page,0);assert.equal(tickPage(430,100).page,1);
 assert.equal(tickPage(430,-1).first,0);assert.equal(tickPage(430,999).last,430);
});
