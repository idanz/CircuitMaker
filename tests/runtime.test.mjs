import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { root, makeWorker, workerBundle, pythonAssets } from './helpers.mjs';
import { compareArtifacts } from '../src/compare.js';

const pythonExecutable = process.env.CIRCUITMAKER_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
function nativePython(example) {
  const script = 'import contextlib,io,json,runpy,sys,types,subprocess;sys.path.insert(0,sys.argv[1]);sys.path.insert(0,sys.argv[3]);import circuit_web;circuit_web.install();\nbridge=types.ModuleType("_circuitmaker_simulation");bridge.run=lambda plan: subprocess.check_output([sys.argv[4],sys.argv[5]],input=plan,text=True);sys.modules[bridge.__name__]=bridge\nwith contextlib.redirect_stdout(io.StringIO()): ns=runpy.run_path(sys.argv[2])\nfrom circuit import Blueprint,Simulation\nfor value in ns.values():\n if isinstance(value,Simulation): value.run()\nprint(json.dumps([{ "name":n,"data":v.to_dict(),"string":v.to_string()} for n,v in ns.items() if isinstance(v,Blueprint)]))';
  return JSON.parse(execFileSync(pythonExecutable, ['-c', script, path.join(root, 'source-python'), example, path.join(root,'browser-python'), process.execPath, path.join(root,'tests/native-simulation.mjs')], { encoding: 'utf8' }));
}

test('primary Python reference: truth tables, networks, bounds, immutability, limits and codec', () => {
  execFileSync(pythonExecutable, [path.join(root, 'tests/python_reference.py')], { encoding: 'utf8', stdio: 'pipe' });
});

test('real execution bundles: native Python parity, browser Python parity, TS parity, errors and cancellation', { timeout: 100_000 }, async t => {
  const py = makeWorker(await workerBundle('python'));
  const ts = makeWorker(await workerBundle('typescript'));
  try {
    await Promise.all([py.wait(m => m.type === 'harness-loaded'), ts.wait(m => m.type === 'harness-loaded')]);
    py.post({ type: 'init', assets: await pythonAssets() }); ts.post({ type: 'init', assets: {} });
    const [pythonReady, typescriptReady] = await Promise.all([py.wait(m => m.type === 'ready' || m.type === 'error'), ts.wait(m => m.type === 'ready' || m.type === 'error')]);
    assert.equal(pythonReady.type, 'ready', pythonReady.message); assert.equal(typescriptReady.type, 'ready', typescriptReady.message);
    for (const example of ['generator', 'simulation', 'contract']) {
      await t.test(`${example}: both bundled runtimes equal native Python`, async () => {
        const pythonPath = path.join(root, example === 'contract' ? 'tests/python_reference.py' : `examples/${example}.py`);
        const expected = nativePython(pythonPath);
        const [pythonCode, tsCode] = await Promise.all([readFile(pythonPath, 'utf8'), readFile(path.join(root, example === 'contract' ? 'tests/typescript_contract.ts' : `examples/${example}.ts`), 'utf8')]);
        py.post({ type: 'run', code: pythonCode }); ts.post({ type: 'run', code: tsCode });
        const [p, s] = await Promise.all([py.wait(m => m.type === 'result' || m.type === 'error'), ts.wait(m => m.type === 'result' || m.type === 'error')]);
        assert.equal(p.type, 'result', p.message); assert.equal(s.type, 'result', s.message);
        if(example!=='contract'){
          assert.equal(p.simulations.length,1);assert.deepEqual(p.simulations,s.simulations);
          assert.match(pythonCode,/scenario\.expect\(/);
          assert.match(tsCode,/scenario\.expect\(/);
        }
        if(example==='generator'){
          const timeline=p.simulations[0].timeline,index=timeline.signals.findIndex(s=>s.name==='signal-A');
          for(const entity of [1,2,3])for(const [tick,count]of [[6,0],[16,1],[26,0]])assert.equal(timeline.frames[tick].outputs[entity]?.[index]??0,count);
        }
        assert.ok(compareArtifacts(p.artifacts.filter(a=>a.kind==='named'), expected).matches); assert.ok(compareArtifacts(s.artifacts.filter(a=>a.kind==='named'), expected).matches);
        for (const artifact of [...p.artifacts, ...s.artifacts]) {
          assert.deepEqual(JSON.parse(inflateSync(Buffer.from(artifact.string.slice(1), 'base64')).toString()), artifact.data);
        }
      });
    }
    await t.test('constructor discovery captures helper locals and loops without duplicating explicit blueprints', async () => {
      const python = `from circuit import Decider, Blueprint, virtual
def build():
    for i in range(2):
        Decider(name='auto', when=virtual('A').greater_than(i), outputs=[virtual('B').output()])
build()
grouped = Decider(name='grouped', when=virtual('A').greater_than(0), outputs=[virtual('B').output()])
blueprint = Blueprint([grouped])`;
      const typescript = `import {Decider, Blueprint, virtual} from 'circuit';
function build() { for(let i=0;i<2;i++) new Decider({name:'auto',when:virtual('A').greaterThan(i),outputs:[virtual('B').output()]}); }
build();
const grouped=new Decider({name:'grouped',when:virtual('A').greaterThan(0),outputs:[virtual('B').output()]});
const blueprint=new Blueprint([grouped]);`;
      py.post({ type: 'run', code: python }); ts.post({ type: 'run', code: typescript });
      const [p, s] = await Promise.all([py.wait(m => m.type === 'result' || m.type === 'error'), ts.wait(m => m.type === 'result' || m.type === 'error')]);
      assert.equal(p.type, 'result', p.message); assert.equal(s.type, 'result', s.message);
      assert.deepEqual(p.artifacts.map(a => a.name), ['__all__', 'blueprint', 'auto', 'auto (2)']);
      assert.ok(compareArtifacts(p.artifacts, s.artifacts).matches);
    });
    await t.test('errors are captured with useful messages', async () => {
      py.post({ type: 'run', code: "from catalog import Items\nItems.iron_plate.output('wrong')" });
      ts.post({ type: 'run', code: "import { Items } from 'catalog'; Items.ironPlate.output('wrong');" });
      const [p, s] = await Promise.all([py.wait(m => m.type === 'error'), ts.wait(m => m.type === 'error')]);
      assert.match(p.message, /signed 32-bit/); assert.match(s.message, /signed 32-bit/);
    });
    await t.test('an infinite loop can be terminated in each execution worker', async () => {
      py.post({ type: 'run', code: 'while True:\n    pass' }); ts.post({ type: 'run', code: 'while (true) {}' });
      await new Promise(resolve => setTimeout(resolve, 150));
      const started = performance.now(); await Promise.all([py.terminate(), ts.terminate()]);
      assert.ok(performance.now() - started < 3000, 'Worker termination must not wait for user code');
    });
  } finally { await Promise.allSettled([py.terminate(), ts.terminate()]); }
});
