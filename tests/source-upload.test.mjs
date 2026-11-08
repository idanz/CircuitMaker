import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSourceFile, availableUploadName } from '../src/source-upload.js';
import { loadWorkspace, WORKSPACE_KEY } from '../src/workspace-storage.js';

test('uploads preserve source text, normalize extensions and strip a UTF-8 BOM', async () => {
  assert.deepEqual(await readSourceFile(new File(['\uFEFFprint("hello")\r\n'], 'example.PY')), { name: 'example.py', code: 'print("hello")\r\n' });
  assert.deepEqual(await readSourceFile(new File([''], 'empty.ts')), { name: 'empty.ts', code: '' });
});

test('unsupported names, binary content and read errors leave existing files intact', async () => {
  for (const name of ['example.txt', '../escape.py', 'bad/name.ts']) {
    await assert.rejects(readSourceFile(new File(['source'], name)), /filename/);
  }
  await assert.rejects(readSourceFile(new File(['a\0b'], 'binary.py')), /binary/);
  await assert.rejects(readSourceFile({ name: 'broken.ts', text: async () => { throw new Error('Read failed'); } }), /Read failed/);
});

test('duplicate uploads get unique names and survive workspace reload', async () => {
  const files = [{ name: 'example.py', code: 'original', language: 'python' }, { name: 'EXAMPLE-2.py', code: 'keep', language: 'python' }];
  for (const code of ['first upload', 'second upload']) {
    const file = await readSourceFile(new File([code], 'example.py'));
    files.push({ ...file, name: availableUploadName(file.name, files), language: 'python' });
  }
  assert.deepEqual(files.map(file => file.name), ['example.py', 'EXAMPLE-2.py', 'example-3.py', 'example-4.py']);
  const restored = loadWorkspace({ getItem: key => key === WORKSPACE_KEY ? JSON.stringify(files) : null }, []);
  assert.deepEqual(restored.files, files);
});
