import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paneBounds, resultsHeight } from '../src/pane-splitter.js';

test('splitter reserves room for both code and output and clamps persisted sizes after window changes', () => {
  assert.deepEqual(paneBounds(600),{min:150,max:520});
  assert.equal(resultsHeight(600,.5),300);
  assert.equal(resultsHeight(600,2),520);
  assert.equal(resultsHeight(600,-1),150);
  assert.equal(resultsHeight(200,.9),140);
  assert.equal(resultsHeight(600,NaN),276);
});

test('very short viewports do not overflow their available pane space', () => {
  for(const available of [0,30,80,120,200]) {
    for(const ratio of [0,.46,.99,Infinity]) {
      const height=resultsHeight(available,ratio);
      assert.ok(Number.isFinite(height));assert.ok(height>=0);assert.ok(height<=available);
    }
  }
});
