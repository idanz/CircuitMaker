import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { root, makeWorker, workerBundle } from './helpers.mjs';

test('Ruff browser bundle formats Python without executing it or changing its AST', { timeout: 25_000 }, async () => {
  const files = await readdir(path.join(root, 'dist/assets'));
  const wasm = files.find(name => name.startsWith('ruff_wasm_bg-') && name.endsWith('.wasm'));
  assert.ok(wasm, 'The Ruff WASM must be bundled locally');
  const harness = makeWorker(await workerBundle('ruff'), { [wasm]: new Uint8Array(await readFile(path.join(root, 'dist/assets', wasm))).buffer });
  let id = 0;
  const format = async source => {
    const requestID = ++id; harness.post({ id: requestID, type: 'format', source });
    return harness.wait(message => message.id === requestID);
  };
  try {
    await harness.wait(message => message.type === 'harness-loaded');
    const result = await format('# keep this comment\nπ=[1,2,3]\nprint( π )\n');
    assert.equal(result.error, undefined); assert.match(result.text, /π = \[1, 2, 3\]/); assert.match(result.text, /# keep this comment/);
    assert.equal((await format(result.text)).text, result.text, 'Formatting must be idempotent');
    const noExecute = await format('raise RuntimeError("Formatting must never execute this")');
    assert.equal(noExecute.error, undefined); assert.match(noExecute.text, /raise RuntimeError/);
    const invalid = await format('def broken(:\n');
    assert.equal(typeof invalid.error, 'string'); assert.equal(invalid.text, undefined);

    const python = process.env.CIRCUITMAKER_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
    for (const example of ['examples/generator.py', 'tests/python_reference.py']) {
      const source = await readFile(path.join(root, example), 'utf8');
      const formatted = await format(source); assert.equal(formatted.error, undefined, formatted.error);
      const comparison = execFileSync(python, ['-c', 'import ast,json,sys;a,b=json.load(sys.stdin);assert ast.dump(ast.parse(a)) == ast.dump(ast.parse(b));print("same AST")'], { input: JSON.stringify([source, formatted.text]), encoding: 'utf8' });
      assert.match(comparison, /same AST/);
    }
  } finally { await harness.terminate(); }
});
