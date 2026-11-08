import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutCircuit} from '../src/circuit-layout.js';
import {describeCircuit} from '../src/circuit-model.js';

const entity=(id,type='Decider')=>({id,type});
const wire=(from,to,fromPort='output',toPort='input',color='red')=>({from:{id:from,port:fromPort,color},to:{id:to,port:toPort,color},color});
const order=circuit=>[...layoutCircuit(circuit)].map(([id])=>id);

test('the cookbook Driver appears left of its combinator regardless of original vertical placement',()=>{
  const data={blueprint:{entities:[{entity_number:1,name:'decider-combinator',position:{x:.5,y:0}},{entity_number:2,name:'circuitmaker-driver',position:{x:.5,y:3}}],wires:[[2,1,1,1]]}};
  const before=JSON.stringify(data),positions=layoutCircuit(describeCircuit(data));
  assert.ok(positions.get(2).x<positions.get(1).x);
  assert.equal(positions.get(2).y,positions.get(1).y);
  assert.equal(JSON.stringify(data),before,'diagram layout must not change exported blueprint placement');
});

test('reversed declarations and reversed wire endpoints still flow from source through successive stages',()=>{
  const circuit={entities:[entity(1),entity(2),entity(3,'Driver')],wires:[wire(1,2,'input','output'),wire(3,2)]};
  assert.deepEqual(order(circuit),[3,2,1]);
});

test('shared input and output buses preserve dependencies and keep branches in one horizontal lane',()=>{
  const circuit={entities:[entity(1),entity(2),entity(3,'Constant'),entity(4,'Driver')],wires:[wire(4,3,'output','output'),wire(3,2),wire(2,1,'input','input')]};
  const positions=layoutCircuit(circuit);
  for(const source of [3,4])for(const target of [1,2])assert.ok(positions.get(source).x<positions.get(target).x);
  assert.equal(new Set([...positions.values()].map(p=>p.y)).size,1);
  const xs=[...positions.values()].map(p=>p.x);
  assert.ok(xs.every((x,i)=>i===0||x-xs[i-1]>=232),'nodes and port badges must have room');
});

test('feedback cycles stay together between their source and downstream output',()=>{
  const circuit={entities:[entity(1),entity(2),entity(3),entity(4,'Driver')],wires:[wire(4,3),wire(3,2),wire(2,3,'output','input','green'),wire(2,1),wire(1,1,'output','input','green')]};
  assert.deepEqual(order(circuit),[4,2,3,1]);
});

test('disconnected and unwired circuits remain deterministic without wrapping vertically',()=>{
  const entities=[entity(3),entity(1),entity(2,'Driver')],circuit={entities,wires:[]};
  assert.deepEqual(order(circuit),[2,1,3]);
  assert.deepEqual(order({...circuit,entities:[...entities].reverse()}),order(circuit));
  assert.deepEqual(order({entities:[],wires:[]}),[]);
});
