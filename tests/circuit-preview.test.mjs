import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCircuit, describeEntity } from '../src/circuit-model.js';

const signal = name => ({type:'virtual',name:`signal-${name}`});
test('inspector preserves exported AND/OR groups, both signal operands, quality, network choices and output modes', () => {
  const entity = describeEntity({entity_number:7,name:'decider-combinator',control_behavior:{decider_conditions:{conditions:[
    {first_signal:signal('A'),first_signal_networks:{red:true,green:false},comparator:'>',constant:10},
    {compare_type:'and',first_signal:{name:'iron-plate',quality:'legendary'},comparator:'=',second_signal:signal('B'),second_signal_networks:{red:false,green:true}},
    {compare_type:'or',first_signal:signal('each'),comparator:'≠',constant:0},
  ],outputs:[{signal:signal('C'),copy_count_from_input:true,networks:{red:false,green:true}},{signal:signal('D'),copy_count_from_input:false,constant:-2}]}}}, 'Gate');
  assert.equal(entity.label,'Gate'); assert.equal(entity.id,7);
  assert.deepEqual(entity.groups.map(group=>group.length),[2,1]);
  assert.deepEqual(entity.groups[0][0].left.networks,['red']);
  assert.equal(entity.groups[0][0].right.value,10);
  assert.equal(entity.groups[0][1].left.signal.quality,'legendary');
  assert.deepEqual(entity.groups[0][1].right.networks,['green']);
  assert.equal(entity.groups[1][0].left.signal.name,'signal-each');
  assert.equal(entity.outputs[0].copy,true);assert.deepEqual(entity.outputs[0].networks,['green']);
  assert.equal(entity.outputs[1].copy,false);assert.equal(entity.outputs[1].count,-2);
});

test('arithmetic keeps zero and negative constants and constant sections retain enabled state and values', () => {
  const math=describeEntity({entity_number:1,name:'arithmetic-combinator',control_behavior:{arithmetic_conditions:{first_constant:0,operation:'*',second_constant:-3,output_signal:signal('A')}}});
  assert.equal(math.arithmetic.left.value,0);assert.equal(math.arithmetic.right.value,-3);assert.equal(math.arithmetic.operation,'*');
  const constant=describeEntity({entity_number:2,name:'constant-combinator',control_behavior:{is_on:false,sections:{sections:[{index:1,group:'Seed',active:false,filters:[{index:1,...signal('A'),count:-4}]}]}}});
  assert.equal(constant.enabled,false);assert.equal(constant.sections[0].enabled,false);assert.equal(constant.sections[0].slots[0].count,-4);
  assert.equal(constant.sections[0].group,'Seed');assert.equal(constant.sections[0].index,1);
  const ungrouped=describeEntity({entity_number:3,name:'constant-combinator',control_behavior:{sections:{sections:[{index:2,filters:[]}]}}});
  assert.equal(ungrouped.sections[0].group,null);assert.equal(ungrouped.sections[0].enabled,true);assert.equal(ungrouped.sections[0].index,2);
});

test('layout resolves entity names, input/output connectors, constant output ports and feedback without inventing omitted devices', () => {
  const circuit=describeCircuit({blueprint:{description:'1: Seed\n2: Memory',entities:[{entity_number:1,name:'constant-combinator',position:{x:0,y:0}},{entity_number:2,name:'decider-combinator',position:{x:2,y:0}}],wires:[[1,1,2,1],[2,4,2,2],[2,3,99,1]]}});
  assert.equal(circuit.entities[0].label,'Seed');assert.equal(circuit.wires.length,2);
  assert.deepEqual(circuit.wires[0],{from:{id:1,port:'output',color:'red'},to:{id:2,port:'input',color:'red'},color:'red'});
  assert.deepEqual(circuit.wires[1],{from:{id:2,port:'output',color:'green'},to:{id:2,port:'input',color:'green'},color:'green'});
  assert.deepEqual(describeCircuit(undefined).entities,[]);
});
