import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Stop promptly cancels a build even while its runtime is still starting', { timeout: 2000 }, async () => {
  const source = (await readFile(new URL('../src/runner.js', import.meta.url), 'utf8'))
    .replace(/^import pythonWorkerURL[^\n]+/m, "const pythonWorkerURL = 'python-worker';")
    .replace(/^import typescriptWorkerURL[^\n]+/m, "const typescriptWorkerURL = 'typescript-worker';");
  const { Runner } = await import('data:text/javascript,' + encodeURIComponent(source));
  const previousDocument = globalThis.document, previousFetch = globalThis.fetch;
  let resolveFrame;
  const frameRequested = new Promise(resolve => { resolveFrame = resolve; });
  const frame = { contentWindow: { postMessage() {} }, remove() {} };
  globalThis.document = { createElement: () => frame, body: { appendChild() { resolveFrame(); /* deliberately slow iframe load */ } } };
  globalThis.fetch = async () => ({ ok: true, text: async () => '// worker' });
  const states = [];
  const runner = new Runner('typescript', state => states.push(state));
  try {
    const build = runner.run('while(true){}', 5000);
    const rejection = assert.rejects(build, /Stopped/);
    await frameRequested;
    runner.stop();
    await rejection;
    assert.equal(runner.ready, false); assert.equal(states.at(-1), 'stopped');
  } finally { runner.stop(); globalThis.document = previousDocument; globalThis.fetch = previousFetch; }
});

test('runtime errors reach the editor immediately after a successful initialization', { timeout: 2000 }, async () => {
  const source = (await readFile(new URL('../src/runner.js', import.meta.url), 'utf8'))
    .replace(/^import pythonWorkerURL[^\n]+/m, "const pythonWorkerURL = 'python-worker';")
    .replace(/^import typescriptWorkerURL[^\n]+/m, "const typescriptWorkerURL = 'typescript-worker';");
  const { Runner } = await import('data:text/javascript,' + encodeURIComponent(source));
  const previousDocument = globalThis.document, previousFetch = globalThis.fetch;
  let peer;
  const frame = { contentWindow: { postMessage(_, __, ports) {
    peer = ports[0]; peer.onmessage = ({ data }) => {
      if (data.type === 'boot') peer.postMessage({ type: 'ready' });
      if (data.type === 'run') peer.postMessage({ type: 'error', message: 'Expected a signed 32-bit integer', logs: [], elapsed: 1 });
    };
    peer.postMessage({ type: 'connected' });
  } }, remove() { peer?.close(); } };
  globalThis.document = { createElement: () => frame, body: { appendChild() { queueMicrotask(() => frame.onload()); } } };
  globalThis.fetch = async () => ({ ok: true, text: async () => '// worker' });
  const runner = new Runner('typescript', () => {});
  try {
    const result = await runner.run('invalid argument', 5000);
    assert.equal(result.type, 'error'); assert.match(result.message, /32-bit/); assert.equal(runner.active, null);
  } finally { runner.stop(); globalThis.document = previousDocument; globalThis.fetch = previousFetch; }
});
