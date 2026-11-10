import pythonWorkerURL from './python-worker.js?worker&url';
import typescriptWorkerURL from './typescript-worker.ts?worker&url';

async function fetchChecked(url, binary = false) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  // Blobs are immutable and share their backing bytes across postMessage hops.
  // ArrayBuffers would be copied into both the frame and the runtime worker.
  return binary ? response.blob() : response.text();
}
let pythonAssets;
let typescriptAssets;
async function assetsFor(language) {
  if (language === 'typescript') return typescriptAssets ??= fetchChecked(typescriptWorkerURL).then(workerSource => ({ workerSource, assets: {} }));
  return pythonAssets ??= (async () => {
    const [workerSource, loader, asm, wasm, stdlib, lock, circuit, catalog] = await Promise.all([
      fetchChecked(pythonWorkerURL), fetchChecked('/vendor/pyodide/pyodide.mjs'), fetchChecked('/vendor/pyodide/pyodide.asm.mjs'),
      fetchChecked('/vendor/pyodide/pyodide.asm.wasm', true), fetchChecked('/vendor/pyodide/python_stdlib.zip', true),
      fetchChecked('/vendor/pyodide/pyodide-lock.json'), fetchChecked('/python/circuit.py'), fetchChecked('/python/catalog.py'),
    ]);
    return { workerSource, assets: { loader, asm, lockfile: lock, circuit, catalog, runtime: { 'pyodide.asm.wasm': wasm, 'python_stdlib.zip': stdlib } } };
  })().finally(() => { pythonAssets = undefined; });
}

export class Runner {
  constructor(language, onState) { this.language = language; this.onState = onState; this.ready = false; this.generation = 0; }
  initialize() {
    if (this.initializing) return this.initializing;
    if (this.ready) return Promise.resolve();
    const generation = ++this.generation;
    const setupTimers = new Set(); this.setupTimers = setupTimers;
    this.onState('starting');
    const cancelled = new Promise((_, reject) => { this.cancelSetup = reject; });
    const setup = (async () => {
      const bundle = await assetsFor(this.language);
      if (generation !== this.generation) throw new Error('Initialization cancelled');
      const iframe = document.createElement('iframe');
      iframe.className = 'runner'; iframe.title = `${this.language} isolated runner`;
      iframe.sandbox = 'allow-scripts'; iframe.src = '/sandbox.html';
      this.iframe = iframe;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Runner frame could not load')), 20_000);
        setupTimers.add(timeout);
        iframe.onload = () => { clearTimeout(timeout); resolve(); };
        iframe.onerror = () => { clearTimeout(timeout); reject(new Error('Runner frame could not load')); };
        document.body.appendChild(iframe);
      });
      if (generation !== this.generation) throw new Error('Initialization cancelled');
      const channel = new MessageChannel(); this.port = channel.port1;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Runtime setup timed out. Press Run to retry.')), 90_000);
        setupTimers.add(timeout);
        this.port.onmessage = ({ data }) => {
          if (generation !== this.generation) return;
          if (this.ready) { this.handleResult?.(data); return; }
          if (data.type === 'connected') this.port.postMessage({ type: 'boot', ...bundle });
          else if (data.type === 'ready') { clearTimeout(timeout); this.ready = true; this.onState('ready'); resolve(); }
          else if (data.type === 'error') { clearTimeout(timeout); reject(new Error(data.message)); }
          else this.handleResult?.(data);
        };
        iframe.contentWindow.postMessage('circuitmaker-connect', '*', [channel.port2]);
      });
    })();
    this.initializing = Promise.race([setup, cancelled]).catch(error => {
      if (generation === this.generation) { this.ready = false; this.onState('error'); this.iframe?.remove(); this.port?.close(); }
      throw error;
    }).finally(() => {
      for (const timer of setupTimers) clearTimeout(timer); setupTimers.clear();
      if (generation === this.generation) { this.initializing = null; this.cancelSetup = null; }
    });
    return this.initializing;
  }
  async run(code, timeout) {
    if (this.active) throw new Error('A build is already running');
    await this.initialize();
    this.onState('running');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop(`Stopped after ${timeout / 1000} seconds. The runtime was reset.`), timeout);
      this.active = { reject, timer };
      this.handleResult = data => {
        if (data.type !== 'result' && data.type !== 'error') return;
        clearTimeout(timer); this.active = null; this.handleResult = null; this.onState('ready');
        // The sandbox is untrusted. Bound and validate everything before display.
        if (JSON.stringify(data).length > 6_200_000) { reject(new Error('Runner response exceeds the output limit')); return; }
        if (data.type === 'result' && (!Array.isArray(data.artifacts) || data.artifacts.some(a => typeof a.name !== 'string' || typeof a.string !== 'string' || (a.label !== undefined && typeof a.label !== 'string') || !a.data?.blueprint))) {
          reject(new Error('Runner returned an invalid blueprint result')); return;
        }
        if (data.type === 'result' && data.simulations !== undefined && (!Array.isArray(data.simulations) || data.simulations.length > 8 || data.simulations.some(s => typeof s?.name !== 'string' || !Array.isArray(s.data?.blueprint?.entities) || s.data.blueprint.entities.length > 256 || !Array.isArray(s.timeline?.signals) || s.timeline.signals.length > 2048 || !Array.isArray(s.timeline?.networks) || s.timeline.networks.length > 1024 || !Array.isArray(s.timeline?.frames) || s.timeline.frames.length < 2 || s.timeline.frames.length > 2001 || !Number.isInteger(s.timeline.ticks) || s.timeline.ticks !== s.timeline.frames.length - 1 || s.timeline.frames.some((frame,i)=>frame?.tick!==i || !Array.isArray(frame.networks) || frame.networks.length!==s.timeline.networks.length || !frame.outputs || typeof frame.outputs!=='object' || !frame.conditions || typeof frame.conditions!=='object')))) {
          reject(new Error('Runner returned an invalid simulation result')); return;
        }
        resolve(data);
      };
      this.port.postMessage({ type: 'run', code });
    });
  }
  stop(message = 'Stopped. The runtime was reset.') {
    ++this.generation;
    this.cancelSetup?.(new Error(message)); this.cancelSetup = null;
    for (const timer of this.setupTimers ?? []) clearTimeout(timer); this.setupTimers?.clear();
    if (this.active) { clearTimeout(this.active.timer); this.active.reject(new Error(message)); this.active = null; }
    this.port?.postMessage({ type: 'stop' }); this.port?.close(); this.iframe?.remove();
    this.ready = false; this.initializing = null; this.handleResult = null; this.onState('stopped');
  }
}
