import { runSimulations, simulateScenario } from './simulation-engine';
import browserAPI from '../browser-python/circuit_web.py?raw';
// This entire module executes in an opaque-origin, network-denied blob worker.
let pyodide;
let logs = [];
let logBytes = 0;
const LIMIT = 24_000;
const MAX_OUTPUT = 6_000_000;
const log = text => {
  if (logBytes >= LIMIT) return;
  const line = String(text).slice(0, LIMIT - logBytes);
  logs.push(line); logBytes += line.length + 1;
};

async function initialize(assets) {
  const realFetch = globalThis.fetch.bind(globalThis);
  // Pyodide fetches its wasm and stdlib from these virtual, in-memory URLs.
  // The inherited CSP denies real network requests, even through the JS bridge.
  globalThis.fetch = async (input, options) => {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    const filename = url.replace('https://runtime.invalid/', '');
    if (Object.hasOwn(assets.runtime, filename)) {
      return new Response(assets.runtime[filename], { headers: { 'Content-Type': filename.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' } });
    }
    return realFetch(input, options);
  };
  const moduleURL = text => URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  const loaderURL = moduleURL(assets.loader);
  const asmURL = moduleURL(assets.asm);
  try {
    const [{ loadPyodide }, asm] = await Promise.all([import(/* @vite-ignore */ loaderURL), import(/* @vite-ignore */ asmURL)]);
    pyodide = await loadPyodide({
      indexURL: 'https://runtime.invalid/',
      lockFileContents: assets.lockfile,
      createPyodideModule: asm.default,
      stdout: log, stderr: log,
      // A convenience restriction only; the browser sandbox is the boundary.
      jsglobals: Object.create(null),
    });
    pyodide.FS.writeFile('/home/pyodide/circuit.py', assets.circuit);
    pyodide.FS.writeFile('/home/pyodide/catalog.py', assets.catalog);
    pyodide.FS.writeFile('/home/pyodide/circuit_web.py', browserAPI);
    pyodide.registerJsModule('_circuitmaker_simulation', { run: plan => JSON.stringify(simulateScenario(JSON.parse(plan))) });
    pyodide.runPython('import circuit, catalog, circuit_web; circuit_web.install()');
    postMessage({ type: 'ready' });
  } finally { URL.revokeObjectURL(loaderURL); URL.revokeObjectURL(asmURL); }
}

function run(code) {
  logs = []; logBytes = 0;
  const start = performance.now();
  const namespace = pyodide.toPy({ __name__: '__circuitmaker__' });
  try {
    pyodide.globals.set('_cm_source', code);
    pyodide.globals.set('_cm_namespace', namespace);
    pyodide.runPython('circuit_web.begin()');
    pyodide.runPython("exec(compile(_cm_source, 'user.py', 'exec'), _cm_namespace)");
    const serialized = pyodide.runPython("import json; json.dumps({'artifacts': circuit_web.collect(_cm_namespace), 'plans': circuit_web.collect_simulations()}, ensure_ascii=False)");
    if (serialized.length > MAX_OUTPUT) throw new Error('Combined blueprint output exceeds 6 MB.');
    const { artifacts, plans } = JSON.parse(serialized);
    const simulations = runSimulations(plans);
    if (artifacts.some(a => JSON.stringify(a).length > 2_000_000)) throw new Error('A blueprint exceeds the 2 MB output limit.');
    if (!artifacts.length && !simulations.length) throw new Error('Create a Decider, Arithmetic or Constant to build a blueprint.');
    if (JSON.stringify({artifacts,simulations}).length > MAX_OUTPUT) throw new Error('Combined results exceed 6 MB. Reduce simulation ticks.');
    postMessage({ type: 'result', artifacts, simulations, logs, truncated: logBytes >= LIMIT, elapsed: performance.now() - start });
  } catch (error) {
    postMessage({ type: 'error', message: String(error), logs, elapsed: performance.now() - start });
  } finally {
    pyodide.runPython('circuit_web.end()');
    pyodide.globals.delete('_cm_source'); pyodide.globals.delete('_cm_namespace'); namespace.destroy();
  }
}

onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') await initialize(data.assets);
    else if (data.type === 'run') run(data.code);
  } catch (error) { postMessage({ type: 'error', message: String(error) }); }
};
