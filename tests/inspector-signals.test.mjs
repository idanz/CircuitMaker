import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectorSignals} from '../src/factorio-inspector.js';

test('signal trays distinguish configured fixed counts from unavailable copied input counts',()=>{
  const sun={type:'virtual',name:'signal-sun'},check={type:'virtual',name:'signal-check'};
  const values=inspectorSignals({groups:[[{left:{signal:sun},right:{value:20}},{left:{signal:sun},right:{signal:check}}]],outputs:[{signal:check,copy:false,count:1},{signal:sun,copy:true}]});
  assert.deepEqual(values.inputs,[sun,check]);
  assert.deepEqual(values.outputs,[{signal:check,count:1},{signal:sun,count:null}]);
});

test('constant and arithmetic trays keep negative counts and quality-specific signal identities',()=>{
  const a={name:'iron-plate'},b={name:'iron-plate',quality:'legendary'};
  assert.deepEqual(inspectorSignals({sections:[{slots:[{...a,count:-4}]}]}).outputs,[{signal:{...a,count:-4},count:-4}]);
  assert.deepEqual(inspectorSignals({arithmetic:{left:{signal:a},right:{signal:b},output:b}}),{inputs:[a,b],outputs:[{signal:b,count:null}]});
});
