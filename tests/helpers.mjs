import { Worker } from 'node:worker_threads';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function workerBundle(language) {
  const files = await readdir(path.join(root, 'dist/assets'));
  return path.join(root, 'dist/assets', files.find(f => f.startsWith(`${language}-worker-`) && f.endsWith('.js')));
}
export function makeWorker(filename, assets = {}) {
  const worker = new Worker(new URL('./execution-thread.mjs', import.meta.url), { workerData: { filename, assets }, execArgv: ['--experimental-vm-modules'] });
  const messages = [], waiters = [];
  worker.on('message', data => {
    if (data.type === 'harness-error') { for (const w of waiters.splice(0)) { clearTimeout(w.timer); w.reject(new Error(data.message)); } return; }
    const i = waiters.findIndex(w => w.predicate(data));
    if (i >= 0) { const [w] = waiters.splice(i, 1); clearTimeout(w.timer); w.resolve(data); }
    else messages.push(data);
  });
  worker.on('error', error => { for (const w of waiters.splice(0)) { clearTimeout(w.timer); w.reject(error); } });
  return {
    worker,
    wait(predicate, timeout = 30_000) {
      const i = messages.findIndex(predicate); if (i >= 0) return Promise.resolve(messages.splice(i, 1)[0]);
      return new Promise((resolve, reject) => { const pending = { predicate, resolve, reject, timer: setTimeout(() => { const i = waiters.indexOf(pending); if (i >= 0) waiters.splice(i, 1); reject(new Error('Worker test timed out')); }, timeout) }; waiters.push(pending); });
    },
    post(data) { worker.postMessage(data); },
    async terminate() { for (const w of waiters.splice(0)) { clearTimeout(w.timer); w.reject(new Error('Worker terminated')); } await worker.terminate(); },
  };
}
export async function pythonAssets() {
  const p = file => path.join(root, 'public', file);
  return {
    loader: await readFile(p('vendor/pyodide/pyodide.mjs'), 'utf8'), asm: await readFile(p('vendor/pyodide/pyodide.asm.mjs'), 'utf8'),
    lockfile: await readFile(p('vendor/pyodide/pyodide-lock.json'), 'utf8'),
    circuit: await readFile(p('python/circuit.py'), 'utf8'), catalog: await readFile(p('python/catalog.py'), 'utf8'),
    runtime: { 'pyodide.asm.wasm': new Uint8Array(await readFile(p('vendor/pyodide/pyodide.asm.wasm'))).buffer, 'python_stdlib.zip': new Uint8Array(await readFile(p('vendor/pyodide/python_stdlib.zip'))).buffer },
  };
}
