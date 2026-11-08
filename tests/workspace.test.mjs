import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkspace,WORKSPACE_KEY,DELETED_FILE_KEY,lastDeletedFile,deleteWorkspaceFile,restoreWorkspaceFile} from '../src/workspace-storage.js';
const defaults=[{name:'starter.py',code:'legacy edited draft',language:'python'}];
const storage=raw=>{const map=new Map(raw===undefined?[]:[[WORKSPACE_KEY,raw],['circuitmaker-lab:crusher:python','original draft']]);return{map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
test('migration retains edited drafts and does not remove old keys',()=>{
 const db=storage();const r=loadWorkspace(db,defaults);assert.equal(r.files[0].code,'legacy edited draft');assert.equal(r.canSave,true);assert.notEqual(r.files[0],defaults[0]);
 const old=storage('[]');loadWorkspace(old,defaults);assert.equal(old.map.get('circuitmaker-lab:crusher:python'),'original draft');
});
test('saved files derive language from extension and never inherit readonly flags',()=>{
 const db=storage(JSON.stringify([{name:'edited.ts',code:'my source',language:'python',readonly:true}]));
 assert.deepEqual(loadWorkspace(db,defaults).files,[{name:'edited.ts',code:'my source',language:'typescript'}]);
});
test('malformed, unsafe and duplicate entries retain a recovery copy before replacement',()=>{
 for(const raw of ['{broken',JSON.stringify([{name:'../escape.py',code:'data'}]),JSON.stringify([{name:'same.py',code:'1'},{name:'SAME.py',code:'2'}])]){
  const db=storage(raw);const r=loadWorkspace(db,defaults);assert.ok(r.warning);assert.equal(db.map.get(WORKSPACE_KEY),raw);assert.ok([...db.map].some(([k,v])=>k.includes(':recovery:')&&v===raw));
 }
});
test('denied storage and failed recovery prevent overwriting existing user data',()=>{
 const r=loadWorkspace({getItem(){throw new Error('denied');}},defaults);assert.equal(r.canSave,false);assert.ok(r.warning);
 const db={getItem:()=>'{broken',setItem(){throw new Error('quota');}};assert.equal(loadWorkspace(db,defaults).canSave,false);
});


test('deletion saves the latest edits for undo across reload and keeps an empty workspace empty',()=>{
 const file={name:'custom.py',code:'my latest edits',language:'python'};
 const db=storage(JSON.stringify([file]));
 const remaining=deleteWorkspaceFile(db,[file],file);
 assert.deepEqual(remaining,[]);
 assert.deepEqual(loadWorkspace(db,defaults).files,[]);
 assert.deepEqual(lastDeletedFile(db),file);
 const restored=restoreWorkspaceFile(db,remaining);
 assert.deepEqual(restored,[file]);
 assert.deepEqual(loadWorkspace(db,defaults).files,[file]);
 assert.equal(lastDeletedFile(db),null);
});

test('failed deletion preserves the workspace and refuses readonly or unrelated files',()=>{
 const file={name:'custom.ts',code:'source',language:'typescript'};
 const original=JSON.stringify([file]);
 for(const blockedKey of [DELETED_FILE_KEY,WORKSPACE_KEY]){
  const db=storage(original),set=db.setItem;
  db.setItem=(key,value)=>{if(key===blockedKey)throw new Error('quota');set(key,value);};
  assert.throws(()=>deleteWorkspaceFile(db,[file],file),/quota/);
  assert.equal(db.map.get(WORKSPACE_KEY),original);
 }
 const db=storage(original);
 assert.throws(()=>deleteWorkspaceFile(db,[file],{...file,readonly:true}),/My Files/);
 assert.throws(()=>deleteWorkspaceFile(db,[file],{...file}),/My Files/);
});

test('undo never overwrites an existing filename or loses recovery on failed saves',()=>{
 const file={name:'custom.py',code:'recover this',language:'python'};
 const db=storage('[]');db.setItem(DELETED_FILE_KEY,JSON.stringify(file));
 assert.throws(()=>restoreWorkspaceFile(db,[{...file,name:'CUSTOM.py',code:'keep this'}]),/already exists/);
 const set=db.setItem;db.setItem=(key,value)=>{if(key===WORKSPACE_KEY)throw new Error('quota');set(key,value);};
 assert.throws(()=>restoreWorkspaceFile(db,[]),/quota/);
 assert.deepEqual(lastDeletedFile(db),file);
});
