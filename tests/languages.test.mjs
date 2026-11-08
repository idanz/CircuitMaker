import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { root, makeWorker } from './helpers.mjs';
import { loadPythonWorkspace, PYTHON_SETTINGS } from '../src/python-workspace.js';

test('TypeScript examples, catalog, helper-return completion, and type errors', () => {
  const libraries = ['public/types/circuit.d.ts', 'public/types/catalog.d.ts'].map(f => path.join(root, f));
  for (const example of ['examples/generator.ts', 'examples/simulation.ts', 'tests/typescript_contract.ts']) {
    const program = ts.createProgram([...libraries, path.join(root, example)], { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.NodeJs, noEmit: true, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
  }

  const cookbook = JSON.parse(readFileSync(path.join(root,'cookbook/manifest.json'),'utf8'));
  const cookbookProgram = ts.createProgram([...libraries,...cookbook.map(r=>path.join(root,`cookbook/${r.id}.ts`))], {strict:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.NodeJs,noEmit:true,lib:['lib.es2022.d.ts','lib.dom.d.ts']});
  assert.deepEqual(ts.getPreEmitDiagnostics(cookbookProgram).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
  const filename = path.join(root, 'probe.ts').replaceAll('\\', '/');
  let code = "import { Signal } from 'circuit'; import { Items } from 'catalog'; function pickSignal(): Signal { return Items.ironPlate; }\npickSignal().green.";
  let version = 1;
  const options = { strict: true, target: ts.ScriptTarget.ES2022, moduleResolution: ts.ModuleResolutionKind.NodeJs };
  const host = { getScriptFileNames: () => [...libraries, filename], getScriptVersion: () => String(version), getScriptSnapshot: file => { try { return ts.ScriptSnapshot.fromString(file === filename ? code : readFileSync(file, 'utf8')); } catch { return undefined; } }, getCurrentDirectory: () => root, getCompilationSettings: () => options, getDefaultLibFileName: o => ts.getDefaultLibFilePath(o), fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory };
  const service = ts.createLanguageService(host);
  const names = service.getCompletionsAtPosition(filename, code.length, {})?.entries.map(e => e.name) ?? [];
  assert.ok(names.includes('atLeast')); assert.ok(names.includes('output'));
  code = "import { Items } from 'catalog'; Items.ironPlate.output('wrong');"; version++;
  assert.ok(service.getSemanticDiagnostics(filename).some(d => d.code === 2345));
  code = "import { Items } from 'catalog'; Items."; version++;
  assert.ok(service.getCompletionsAtPosition(filename, code.length, {})?.entries.some(e => e.name === 'ironPlate'));
  code = "import { Operation } from 'circuit'; Operation."; version++;
  const operations = service.getCompletionsAtPosition(filename, code.length, {})?.entries.map(e => e.name) ?? [];
  assert.ok(operations.includes('MULTIPLY') && operations.includes('ADD'));
  code = "import { Arithmetic } from 'circuit'; import { Virtual } from 'catalog'; new Arithmetic({name:'bad',left:Virtual.A,operation:'multiply',right:2,output:Virtual.B});"; version++;
  assert.ok(service.getSemanticDiagnostics(filename).some(d => /multiply/.test(ts.flattenDiagnosticMessageText(d.messageText,'\n'))), 'Unsupported arithmetic operations must be rejected by TypeScript');
  code = "import {Blueprint, Arithmetic, Constant, Operation, wire, WireColor, Port} from 'circuit'; import {Virtual} from 'catalog'; const seed=new Constant({name:'seed',outputs:[Virtual.A.output(2)]}); const math=new Arithmetic({name:'math',left:Virtual.A,operation:Operation.ADD,right:1,output:Virtual.B}); const group=new Blueprint([seed,math]); wire(seed,math,{color:WireColor.GREEN,sourcePort:Port.OUTPUT});"; version++;
  assert.deepEqual(service.getSemanticDiagnostics(filename).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
  code += "wire(seed,math,{color:'blue'});"; version++;
  assert.ok(service.getSemanticDiagnostics(filename).some(d=>/blue/.test(ts.flattenDiagnosticMessageText(d.messageText,'\n'))));
  code = "import { WireColor } from 'circuit'; WireColor."; version++;
  const colors=service.getCompletionsAtPosition(filename,code.length,{})?.entries.map(e=>e.name)??[];
  assert.ok(colors.includes('RED')&&colors.includes('GREEN'));
  service.dispose();
});

test('actual Pyright browser bundle resolves catalog, helper returns and type errors', { timeout: 90_000 }, async () => {
  const harness = makeWorker(path.join(root, 'public/vendor/pyright/worker.js'));
  let id = 0, version = 1;
  const uri = 'file:///user.py';
  const notify = (method, params) => harness.post({ jsonrpc: '2.0', method, params });
  const request = async (method, params) => { const requestID = ++id; harness.post({ jsonrpc: '2.0', id: requestID, method, params }); const result = await harness.wait(m => m.id === requestID && !m.method); assert.ok(!result.error, result.error?.message); return result.result; };
  try {
    await harness.wait(m => m.type === 'serverLoaded');
    harness.post({ type: 'initServer', userFiles: await loadPythonWorkspace(name => readFile(path.join(root, 'public/python', name), 'utf8')) });
    await harness.wait(m => m.type === 'serverInitialized');
    await request('initialize', { rootUri: 'file:///', rootPath: '/', processId: null, capabilities: { textDocument: { publishDiagnostics: { versionSupport: true } } } });
    notify('initialized', {});
    notify('workspace/didChangeConfiguration', { settings: PYTHON_SETTINGS });
    let code = 'from circuit import Signal\nfrom catalog import Items\ndef pick_signal() -> Signal:\n    return Items.iron_plate\npick_signal().green.';
    notify('textDocument/didOpen', { textDocument: { uri, languageId: 'python', version, text: code } });
    const completion = await request('textDocument/completion', { textDocument: { uri }, position: { line: 4, character: code.split('\n').at(-1).length } });
    const names = (completion.items ?? completion).map(i => i.label);
    assert.ok(names.includes('at_least'), `Expected at_least, got ${names.join(',')}`); assert.ok(names.includes('output'));
    code = 'from catalog import Items\nItems.';
    notify('textDocument/didChange', { textDocument: { uri, version: ++version }, contentChanges: [{ text: code }] });
    const catalogCompletion = await request('textDocument/completion', { textDocument: { uri }, position: { line: 1, character: 6 } });
    assert.ok((catalogCompletion.items ?? catalogCompletion).some(i => i.label === 'iron_plate'));
    // Exercise the real language server: documentation must survive stub loading,
    // signature help, hover, and lazy completion resolution.
    for (const [method, expected] of [['at', 'Update the held signals'], ['pulse', 'Temporarily add signals']]) {
      const prefix = 'from circuit import Driver\nfrom catalog import Virtual\ninputs = Driver("inputs")\n';
      code = prefix + `inputs.${method}(`;
      notify('textDocument/didChange', { textDocument: { uri, version: ++version }, contentChanges: [{ text: code }] });
      const help = await request('textDocument/signatureHelp', { textDocument: { uri }, position: { line: 3, character: code.split('\n').at(-1).length } });
      const docText = doc => typeof doc === 'string' ? doc : doc?.value ?? '';
      assert.ok(help?.signatures.some(s => docText(s.documentation).includes(expected)), `${method} signature help must include its description`);
      assert.ok(help.signatures.some(s => docText(s.documentation).includes('Example:')), `${method} must include a usage example`);
      const hover = await request('textDocument/hover', { textDocument: { uri }, position: { line: 3, character: 8 } });
      assert.ok(docText(hover?.contents).includes(expected), `${method} hover must include documentation`);
      code = prefix + 'inputs.';
      notify('textDocument/didChange', { textDocument: { uri, version: ++version }, contentChanges: [{ text: code }] });
      const result = await request('textDocument/completion', { textDocument: { uri }, position: { line: 3, character: 7 } });
      const item = (result.items ?? result).find(i => i.label === method);
      assert.ok(item, `${method} must appear in completions`);
      const resolved = await request('completionItem/resolve', item);
      assert.ok(docText(resolved.documentation).includes(expected), `${method} completion details must include documentation`);
    }
    // Constructor keyword hover must describe the argument, not just its type.
    for (const [constructor, args, parameter, expected] of [
      ['Signal', 'name="signal-A", network="green"', 'network', 'Input networks to read'],
      ['Output', 'signal=Virtual.A, count=2', 'count', 'Fixed signed 32-bit count'],
      ['Decider', 'name="Gate", when=Virtual.A.equals(1), outputs=[Virtual.B.output(1)]', 'when', 'Condition that controls every output'],
      ['Blueprint', 'entities=[], label="Example"', 'label', 'Name shown for the exported blueprint'],
      ['Arithmetic', 'name="Scale", left=Virtual.A, operation="*", right=2, output=Virtual.B', 'right', 'Second operand'],
      ['Constant', 'name="Seed", outputs=[Virtual.A.output(1)], enabled=True', 'enabled', 'Whether the constant emits'],
      ['Device', 'name="Lamp", prototype="small-lamp", when=Virtual.A.equals(1)', 'when', 'Optional circuit condition'],
      ['Driver', 'name="Source", signals=[Virtual.A.output(1)]', 'signals', 'Initial held signal'],
      ['Simulation', 'entities=[], ticks=20', 'ticks', 'Number of game ticks'],
    ]) {
      code = `from circuit import ${constructor}\nfrom catalog import Virtual\n${constructor}(${args})`;
      notify('textDocument/didChange', { textDocument: { uri, version: ++version }, contentChanges: [{ text: code }] });
      const line = code.split('\n')[2], character = line.indexOf(`${parameter}=`) + 1;
      const hover = await request('textDocument/hover', { textDocument: { uri }, position: { line: 2, character } });
      assert.ok((hover?.contents?.value ?? '').includes(expected), `${constructor}.${parameter} keyword hover: ${JSON.stringify(hover)}`);
      const help = await request('textDocument/signatureHelp', { textDocument: { uri }, position: { line: 2, character: line.indexOf(`${parameter}=`) + parameter.length + 1 } });
      assert.ok(help?.signatures.some(s => s.parameters?.some(p => (p.documentation?.value ?? p.documentation ?? '').includes(expected))), `${constructor}.${parameter} signature parameter documentation`);
    }
    // Valid imports must resolve their real sources. Do not hide the warning:
    // genuinely missing imports below must continue to produce diagnostics.
    for (const example of ['generator', 'simulation', ...(await readdir(path.join(root,'cookbook'))).filter(f=>f.endsWith('.py')).map(f=>'cookbook/'+f)]) {
      code = await readFile(path.join(root, example.startsWith('cookbook/') ? example : `examples/${example}.py`), 'utf8');
      notify('textDocument/didChange', { textDocument: { uri, version: ++version }, contentChanges: [{ text: code }] });
      const valid = await harness.wait(m => m.method === 'textDocument/publishDiagnostics' && m.params.version === version);
      assert.deepEqual(valid.params.diagnostics.filter(d => d.severity === 1 || d.severity === 2), [], `${example} must not have missing-source warnings`);
    }
    code = 'from circuit import Operation\nOperation.';
    notify('textDocument/didChange', { textDocument: { uri, version: ++version }, contentChanges: [{ text: code }] });
    const opCompletion = await request('textDocument/completion', {textDocument:{uri},position:{line:1,character:10}});
    assert.ok((opCompletion.items ?? opCompletion).some(i => i.label === 'MULTIPLY'));
    code = 'from circuit import Arithmetic\nfrom catalog import Virtual\nArithmetic(name="bad",left=Virtual.A,operation="multiply",right=2,output=Virtual.B)';
    notify('textDocument/didChange', { textDocument: { uri, version: ++version }, contentChanges: [{ text: code }] });
    const invalidOperation = await harness.wait(m => m.method === 'textDocument/publishDiagnostics' && m.params.version === version);
    assert.ok(invalidOperation.params.diagnostics.some(d => d.severity === 1 && /operation/.test(d.message)), 'Unsupported arithmetic operations must be rejected by Pyright');
    code = 'from circuit import Blueprint, Arithmetic, Constant, Operation, wire, WireColor, Port\nfrom catalog import Virtual\nseed=Constant("seed",[Virtual.A.output(2)])\nmath=Arithmetic("math",Virtual.A,Operation.ADD,1,Virtual.B)\ngroup=Blueprint([seed,math])\nwire(seed,math,color=WireColor.GREEN,source_port=Port.OUTPUT)';
    notify('textDocument/didChange',{textDocument:{uri,version:++version},contentChanges:[{text:code}]});
    const mixed = await harness.wait(m=>m.method==='textDocument/publishDiagnostics'&&m.params.version===version);
    assert.deepEqual(mixed.params.diagnostics.filter(d=>d.severity===1||d.severity===2),[]);
    code += '\nwire(seed,math,color="blue")';
    notify('textDocument/didChange',{textDocument:{uri,version:++version},contentChanges:[{text:code}]});
    const badWire = await harness.wait(m=>m.method==='textDocument/publishDiagnostics'&&m.params.version===version);
    assert.ok(badWire.params.diagnostics.some(d=>d.severity===1&&/color/.test(d.message)));
    code = 'import nonexistent_circuitmaker_module';
    notify('textDocument/didChange', { textDocument: { uri, version: ++version }, contentChanges: [{ text: code }] });
    const missing = await harness.wait(m => m.method === 'textDocument/publishDiagnostics' && m.params.version === version);
    assert.ok(missing.params.diagnostics.some(d => /could not be resolved/.test(d.message)), 'Genuine missing modules must still be diagnosed');
    code = 'from catalog import Items\nItems.iron_plate.output("wrong")';
    notify('textDocument/didChange', { textDocument: { uri, version: ++version }, contentChanges: [{ text: code }] });
    const diagnostic = await harness.wait(m => m.method === 'textDocument/publishDiagnostics' && m.params.version === version && m.params.diagnostics.some(d => /str|int/.test(d.message)));
    assert.ok(diagnostic.params.diagnostics.some(d => d.severity === 1));
  } finally { await harness.terminate(); }
});
