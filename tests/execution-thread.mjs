// Unit-test harness for the actual browser bundles, not a replacement browser.
// A VM supplies Web Worker globals; browser CSP/DOM behavior still needs UI QA.
import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const blobs = new Map();
class TestURL extends URL {
  static createObjectURL(blob) { const id = `blob:unit-test/${blobs.size}`; blobs.set(id, blob); return id; }
  static revokeObjectURL(id) { blobs.delete(id); }
}
const listeners = new Set();
const BoundedArrayBuffer = new Proxy(ArrayBuffer, {
  construct(target, args) {
    if (args[1]?.maxByteLength > workerData.maxResizableBytes) throw new RangeError('Analyzer requested an oversized resizable buffer');
    return Reflect.construct(target, args);
  },
});
const globals = {
  console: { ...console, log() {}, info() {}, debug() {}, warn() {} },
  performance, URL: TestURL, Blob, Response, Request, Headers, TextEncoder, TextDecoder,
  crypto, atob, btoa, structuredClone, DOMException,
  ArrayBuffer, SharedArrayBuffer, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array, DataView,
  AbortController, AbortSignal, Event, EventTarget, MessageChannel, MessagePort,
  WorkerGlobalScope: class WorkerGlobalScope { static [Symbol.hasInstance]() { return true; } },
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  navigator: { userAgent: 'Unit test Web Worker globals' },
  location: new URL('https://runtime.invalid/worker.js'),
  onmessage: null,
  postMessage: data => parentPort.postMessage(data),
  addEventListener(type, listener) { if (type === 'message') listeners.add(listener); },
  removeEventListener(type, listener) { if (type === 'message') listeners.delete(listener); },
  fetch(input) {
    const filename = String(input?.url ?? input).split('/').at(-1);
    if (Object.hasOwn(workerData.assets ?? {}, filename)) return Promise.resolve(new Response(workerData.assets[filename], { headers: { 'Content-Type': 'application/wasm' } }));
    return Promise.reject(new Error('Network unavailable in runtime unit test'));
  },
  importScripts() { throw new Error('Unexpected classic worker import'); },
};
globals.self = globals;
if (workerData.maxResizableBytes) globals.ArrayBuffer = BoundedArrayBuffer;
const context = vm.createContext(globals);
const moduleCache = new Map();
async function importModuleDynamically(specifier) {
  if (!blobs.has(specifier)) throw new Error(`Unexpected import in worker bundle: ${specifier}`);
  if (!moduleCache.has(specifier)) {
    const module = new vm.SourceTextModule(await blobs.get(specifier).text(), { context, identifier: specifier,
      initializeImportMeta(meta) { meta.url = specifier; }, importModuleDynamically });
    moduleCache.set(specifier, module);
    await module.link(importModuleDynamically); await module.evaluate();
  }
  return moduleCache.get(specifier);
}
try {
  const code = await readFile(workerData.filename, 'utf8');
  new vm.Script(code, { filename: workerData.filename, importModuleDynamically }).runInContext(context);
  parentPort.on('message', data => {
    const event = { data };
    Promise.resolve(globals.onmessage?.(event)).catch(error => parentPort.postMessage({ type: 'harness-error', message: error.stack }));
    for (const listener of [...listeners]) listener(event);
  });
  parentPort.postMessage({ type: 'harness-loaded' });
} catch (error) { parentPort.postMessage({ type: 'harness-error', message: error.stack }); }
