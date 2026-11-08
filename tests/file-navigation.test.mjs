import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileSelectionHash,fileFromHash} from '../src/file-navigation.js';

const workspace=[{name:'12-positive-memory.py',language:'python'},{name:'my circuit.ts',language:'typescript'},{name:'測定 #1 + %.py',language:'python'}];
const cookbook=[{name:'12-positive-memory.py',id:'12-positive-memory',language:'python',readonly:true},{name:'12-positive-memory.ts',id:'12-positive-memory',language:'typescript',readonly:true}];

test('refresh resolves the exact file, language and scope without confusing editable copies',()=>{
 for(const file of [...workspace,...cookbook])assert.equal(fileFromHash(fileSelectionHash(file),workspace,cookbook),file);
 assert.equal(fileSelectionHash(cookbook[1]),'#cookbook/12-positive-memory.ts');
 assert.equal(fileFromHash('#workspace/12-positive-memory.py',workspace,cookbook),workspace[0]);
 assert.equal(fileFromHash('#cookbook/12-positive-memory.py',workspace,cookbook),cookbook[0]);
 assert.match(fileSelectionHash(workspace[2]),/%23/);
});

test('missing, deleted, malformed and unknown links cannot create files or escape file lookup',()=>{
 const original=JSON.stringify({workspace,cookbook});
 for(const hash of ['', '#other/test.py','#workspace/missing.py','#workspace/%E0%A4%A','#cookbook/..%2Foutside.py','#workspace/https%3A%2F%2Fexample.com%2Fa.py'])assert.equal(fileFromHash(hash,workspace,cookbook),undefined);
 assert.equal(fileFromHash(fileSelectionHash(workspace[0]),[],cookbook),undefined,'deleted workspace file cannot resolve to its cookbook namesake');
 assert.equal(JSON.stringify({workspace,cookbook}),original);
});
