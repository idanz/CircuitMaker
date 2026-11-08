import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, mkdir, mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { root } from './helpers.mjs';
import { compareArtifacts } from '../src/compare.js';

test('comparison ignores key order but detects actual blueprint differences and missing artifacts', () => {
  const a = [{ name: 'manager', data: { blueprint: { version: 1, entities: [{ x: 1, y: 2 }] } } }];
  const b = [{ name: 'manager', data: { blueprint: { entities: [{ y: 2, x: 1 }], version: 1 } } }];
  assert.ok(compareArtifacts(a, b).matches);
  b[0].data.blueprint.entities[0].x = 3;
  assert.equal(compareArtifacts(a, b).difference, 'manager.blueprint.entities.0.x');
  assert.equal(compareArtifacts(a, []).difference, 'manager');
});
test('the web runtime uses its own Python sources', async () => {
  for (const name of ['circuit.py', 'catalog.py']) {
    assert.deepEqual(await readFile(path.join(root, 'public/python', name)), await readFile(path.join(root, 'source-python', name)));
  }
  await assert.rejects(stat(path.join(root, 'public/python/supply.py')), { code: 'ENOENT' });
});

test('asset preparation ignores neighboring CLI files and removes retired generated supply assets', { timeout: 30_000 }, async () => {
  const scratch = path.join(root, '.test-build');
  await mkdir(scratch, { recursive: true });
  const fixture = await mkdtemp(path.join(scratch, 'independent-'));
  const checkout = path.join(fixture, 'web');
  try {
    await mkdir(checkout);
    for (const directory of ['scripts', 'source-python', 'src']) {
      await cp(path.join(root, directory), path.join(checkout, directory), { recursive: true });
    }
    for (const asset of ['pyodide', 'monaco-pyright-lsp/dist/worker.js', '@astral-sh/ruff-wasm-web/LICENSE']) {
      const destination = path.join(checkout, 'node_modules', asset);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(path.join(root, 'node_modules', asset), destination, { recursive: true, dereference: true });
    }
    for (const name of ['circuit.py', 'catalog.py', 'supply.py']) await writeFile(path.join(fixture, name), 'INVALID NEIGHBORING CLI FILE');
    await mkdir(path.join(checkout, 'public/python'), { recursive: true });
    await writeFile(path.join(checkout, 'public/python/supply.py'), 'obsolete generated starter');
    execFileSync(process.execPath, ['scripts/prepare-assets.mjs'], { cwd: checkout, stdio: 'pipe' });
    for (const name of ['circuit.py', 'catalog.py']) {
      const expected = await readFile(path.join(root, 'source-python', name));
      assert.deepEqual(await readFile(path.join(checkout, 'source-python', name)), expected);
      assert.deepEqual(await readFile(path.join(checkout, 'public/python', name)), expected);
    }
    await assert.rejects(stat(path.join(checkout, 'public/python/supply.py')), { code: 'ENOENT' });
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
test('catalog suggestions have the same names and real local icons in both languages', async () => {
  const catalog = JSON.parse(await readFile(path.join(root, 'public/signals/catalog.json'), 'utf8'));
  assert.equal(Object.values(catalog).flat().length, 2249);
  const iron = catalog.Items.find(i => i.python === 'iron_plate');
  assert.equal(iron.typescript, 'ironPlate'); assert.equal(iron.name, 'iron-plate'); assert.ok(iron.icons.length);
  const files = new Set(Object.values(catalog).flat().flatMap(i => i.icons.map(icon => icon.src)));
  for (const file of files) assert.ok((await stat(path.join(root, 'public', file))).size > 24);
});
