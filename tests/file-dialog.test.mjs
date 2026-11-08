import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { availableUploadName } from '../src/source-upload.js';
import { fileSelectionHash } from '../src/file-navigation.js';

// Exercise the real dialog handlers without starting Monaco and both runtimes.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('function createFile()'), source.indexOf('function addFile('));
function setup(files = [], activeFile = files[0]) {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', open: false, validationMessage: '',
      setCustomValidity(message) { this.validationMessage = message; },
      reportValidity() {}, focus() { this.focused = true; }, select() { this.selected = true; },
      showModal() { this.open = true; }, close() { this.open = false; },
    });
    return elements.get(id);
  };
  const context = vm.createContext({ $, workspaceFiles: files, activeFile, renamingFile: null,
    availableUploadName, fileSelectionHash, simulationPython: 'python starter', simulationTypeScript: 'ts starter',
    created: [], addFile(name, code) { context.created.push({ name, code }); return true; },
    fileStates: new WeakMap(), lanes: {}, history: { replaceState(...args) { context.hash = args[2]; } },
    persistWorkspace() { context.saved = JSON.stringify(files); }, renderFiles() { context.rendered = true; },
    monaco: { Uri: { parse: value => value }, editor: { createModel(code, language, uri) {
      return { getValue: () => code, language, uri };
    } } },
  });
  vm.runInContext(handlers, context);
  return { context, $, submit: () => context.submitFileDialog({ preventDefault() {} }) };
}

test('new files have a selected, available suggestion that can be submitted unchanged', () => {
  for (const language of ['python', 'typescript']) {
    const extension = language === 'python' ? '.py' : '.ts';
    const { context, $, submit } = setup([{ name: `MY_CIRCUIT${extension}`, language }]);
    context.createFile();
    assert.equal($('#new-file-language').value, language);
    assert.equal($('#new-file-name').value, 'my_circuit-2');
    assert.equal($('#new-file-name').focused, true);
    assert.equal($('#new-file-name').selected, true);
    assert.equal(context.created.length, 0);
    submit();
    assert.equal(context.created[0].name, `my_circuit-2${extension}`);
    assert.equal(context.created[0].code, language === 'python' ? 'python starter' : 'ts starter');
    assert.equal($('#new-file-dialog').open, false);
  }
});

test('language choice determines the extension and starter; invalid and duplicate names stay open', () => {
  const { context, $, submit } = setup([{ name: 'taken.ts', language: 'python' }]);
  context.createFile();
  $('#new-file-language').value = 'typescript';
  for (const name of ['../escape', '   ', 'TAKEN']) {
    $('#new-file-name').value = name;
    submit();
    assert.ok($('#new-file-name').validationMessage);
    assert.equal($('#new-file-dialog').open, true);
    assert.equal(context.created.length, 0);
  }
  $('#new-file-name').value = 'custom.ts';
  submit();
  assert.equal(context.created[0].name, 'custom.ts');
  assert.equal(context.created[0].code, 'ts starter');
});

test('rename preserves current source, view and build state and updates storage and URL', () => {
  const file = { name: 'before.py', language: 'python', code: 'older source' };
  const { context, $, submit } = setup([file]);
  const previous = { getValue: () => 'latest edited source', dispose() { this.disposed = true; } };
  const state = { model: previous, result: { blueprint: 'existing build' } };
  context.fileStates.set(file, state);
  const view = { cursor: 42 };
  const editor = { saveViewState: () => view, setModel(model) { this.model = model; }, restoreViewState(state) { this.view = state; } };
  context.lanes.python = { editor };
  context.openFileDialog(file);
  assert.equal($('#new-file-language').disabled, true);
  $('#new-file-name').value = 'after';
  submit();
  assert.equal(file.name, 'after.py');
  assert.equal(file.code, 'latest edited source');
  assert.equal(editor.model.uri, 'file:///workspace/after.py');
  assert.equal(editor.view, view);
  assert.equal(previous.disposed, true);
  assert.equal(state.result.blueprint, 'existing build');
  assert.equal(JSON.parse(context.saved)[0].name, 'after.py');
  assert.equal(context.hash, '#workspace/after.py');
  assert.equal($('#python-filename').textContent, 'after.py');
  assert.equal(context.rendered, true);
});
