import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waveformPath} from '../src/simulation-chart.js';

const x=tick=>tick*10,y=value=>100-value;
test('lines always connect adjacent integer tick samples, including decreases and zero crossings',()=>{
  const values=[0,5,5,-3,0],before=[...values];
  assert.equal(waveformPath(values,x,y),'M0,100 L10,95 L20,95 L30,103 L40,100');
  assert.deepEqual(values,before,'drawing never changes captured values');
});

test('empty and single-sample timelines remain valid paths',()=>{
  assert.equal(waveformPath([],x,y),'');
  assert.equal(waveformPath([7],x,y),'M0,93');
});
