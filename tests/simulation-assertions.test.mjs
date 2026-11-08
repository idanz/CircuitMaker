import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeWorker, workerBundle, pythonAssets} from './helpers.mjs';

const python = `from circuit import Decider, Driver, Simulation, WireColor, Port, wire
from catalog import Virtual
gate = Decider('Gate', Virtual.A.greater_than(0), [Virtual.B.output(1)])
source = Driver('Input', [Virtual.A.output(2), Virtual.B.output(3), Virtual.A.with_quality('legendary').output(9)])
wire(source, gate, color=WireColor.GREEN)
wire(source, gate, color=WireColor.GREEN, target_port=Port.OUTPUT)
scenario = Simulation([source, gate], ticks=4)
result = scenario.run()
assert result.value(0, gate, Virtual.B) == 0
assert result.value(1, gate, Virtual.B) == 1
assert result.network_value(1, gate, Virtual.B, color=WireColor.GREEN, port=Port.OUTPUT) == 4
assert result.value(4, gate, Virtual.C) == 0
assert result.value(0, source, Virtual.A.with_quality('legendary')) == 9
assert result.network_value(0, gate, Virtual.A, color=WireColor.GREEN) == 2
assert result.network_value(0, gate, Virtual.A, color=WireColor.RED) == 0
assert result.network_value(0, source, Virtual.A, color=WireColor.GREEN, port=Port.OUTPUT) == 2
source.at(0, [], reset_others=True)
assert scenario.run().value(1, gate, Virtual.B) == 0
assert result.value(1, gate, Virtual.B) == 1
other = Driver('Outside')
checks = [lambda: result.value(-1, gate, Virtual.A), lambda: result.value(5, gate, Virtual.A), lambda: result.value(0.5, gate, Virtual.A), lambda: result.value(0, other, Virtual.A), lambda: result.value(0, gate, Virtual.each), lambda: result.network_value(0, source, Virtual.A, color=WireColor.RED)]
for check in checks:
    try:
        check()
    except (ValueError, TypeError):
        pass
    else:
        raise AssertionError('Invalid read must fail')
print('checks passed')
`;

const typescript = `import {Decider, Driver, Simulation, WireColor, Port, wire} from 'circuit';
import {Virtual} from 'catalog';
function assert(ok: boolean, message = 'Result mismatch'): asserts ok { if (!ok) throw new Error(message); }
const gate = new Decider({name:'Gate', when:Virtual.A.greaterThan(0), outputs:[Virtual.B.output(1)]});
const source = new Driver({name:'Input', signals:[Virtual.A.output(2), Virtual.B.output(3), Virtual.A.withQuality('legendary').output(9)]});
wire(source, gate, {color:WireColor.GREEN});
wire(source, gate, {color:WireColor.GREEN, targetPort:Port.OUTPUT});
const scenario = new Simulation({entities:[source, gate], ticks:4});
const result = scenario.run();
assert(result.value(0, gate, Virtual.B) === 0);
assert(result.value(1, gate, Virtual.B) === 1);
assert(result.networkValue(1, gate, Virtual.B, {color:WireColor.GREEN, port:Port.OUTPUT}) === 4);
assert(result.value(4, gate, Virtual.C) === 0);
assert(result.value(0, source, Virtual.A.withQuality('legendary')) === 9);
assert(result.networkValue(0, gate, Virtual.A, {color:WireColor.GREEN}) === 2);
assert(result.networkValue(0, gate, Virtual.A, {color:WireColor.RED}) === 0);
assert(result.networkValue(0, source, Virtual.A, {color:WireColor.GREEN, port:Port.OUTPUT}) === 2);
source.at(0, [], true);
assert(scenario.run().value(1, gate, Virtual.B) === 0);
assert(result.value(1, gate, Virtual.B) === 1);
const other = new Driver({name:'Outside'});
const checks = [()=>result.value(-1, gate, Virtual.A), ()=>result.value(5, gate, Virtual.A), ()=>result.value(0.5, gate, Virtual.A), ()=>result.value(0, other, Virtual.A), ()=>result.value(0, gate, Virtual.each), ()=>result.networkValue(0, source, Virtual.A, {color:WireColor.RED})];
for (const check of checks) { let threw=false; try { check(); } catch { threw=true; } assert(threw, 'Invalid read must fail'); }
console.log('checks passed');
`;

test('script result reads, snapshots, validation and assertion failures work in both workers', {timeout:90000}, async () => {
  for (const [language,code,failure] of [
    ['python',python,`assert result.value(1, gate, Virtual.B) == 9, 'Expected nine B at tick 1'`],
    ['typescript',typescript,`assert(result.value(1, gate, Virtual.B) === 9, 'Expected nine B at tick 1');`],
  ]) {
    const worker=makeWorker(await workerBundle(language));
    try {
      await worker.wait(m=>m.type==='harness-loaded');
      worker.post({type:'init', ...(language==='python'?{assets:await pythonAssets()}:{})});
      const ready=await worker.wait(m=>['ready','error'].includes(m.type));
      assert.equal(ready.type,'ready',ready.message);
      worker.post({type:'run',code});
      const success=await worker.wait(m=>['result','error'].includes(m.type));
      assert.equal(success.type,'result',success.message);
      assert.ok(success.logs.includes('checks passed'));
      // The UI timeline uses the final schedule, while earlier results stay unchanged.
      assert.deepEqual(success.simulations[0].timeline.frames[1].outputs['1'],{});
      worker.post({type:'run',code:code+failure});
      const failed=await worker.wait(m=>['result','error'].includes(m.type));
      assert.equal(failed.type,'error');
      assert.match(failed.message,/Expected nine B at tick 1/);
      worker.post({type:'run',code});
      const again=await worker.wait(m=>['result','error'].includes(m.type));
      assert.equal(again.type,'result',again.message);
      assert.equal(again.simulations.length,1,'capture resets after assertion failure');
    } finally { await worker.terminate(); }
  }
});

test('declarative expectations run automatically, validate inputs and explain mismatches in both languages', {timeout:90000}, async()=>{
  const py=`from circuit import Decider, Driver, Simulation, WireColor, Port, wire
from catalog import Virtual
gate=Decider('Gate',Virtual.A.greater_than(0),[Virtual.B.output(1)])
source=Driver('Input',[Virtual.A.output(2),Virtual.B.output(3),Virtual.A.with_quality('legendary').output(9)])
wire(source,gate,color=WireColor.GREEN)
wire(source,gate,color=WireColor.GREEN,target_port=Port.OUTPUT)
scenario=Simulation([source,gate],ticks=4,name='Gate checks')
scenario.expect(0,gate,[Virtual.B.output(0)]).expect(1,gate,[Virtual.B.output(1),Virtual.C.output(0)])
scenario.expect(4,gate,[Virtual.B.output(1)])
scenario.expect(0,source,[Virtual.A.with_quality('legendary').output(9)])
scenario.expect(1,gate,[Virtual.B.output(4)],color=WireColor.GREEN,port=Port.OUTPUT)
scenario.expect(0,gate,[Virtual.A.output(2)],color=WireColor.GREEN)
scenario.expect(0,source,[Virtual.A.output(2)],color=WireColor.GREEN,port=Port.OUTPUT)
assert scenario.run().value(1,gate,Virtual.B)==1
outside=Driver('Outside')
checks=[lambda: scenario.expect(-1,gate,[Virtual.B.output(0)]),lambda: scenario.expect(5,gate,[Virtual.B.output(0)]),lambda: scenario.expect(0.5,gate,[Virtual.B.output(0)]),lambda: scenario.expect(True,gate,[Virtual.B.output(0)]),lambda: scenario.expect(0,outside,[Virtual.B.output(0)]),lambda: scenario.expect(0,gate,[]),lambda: scenario.expect(0,gate,[Virtual.each.output(1)]),lambda: scenario.expect(0,gate,[Virtual.B.copy_input()]),lambda: scenario.expect(0,gate,[Virtual.B.output(0)],color='blue'),lambda: scenario.expect(0,gate,[Virtual.B.output(0)],port=Port.OUTPUT),lambda: scenario.expect(0,source,[Virtual.B.output(0)],color=WireColor.GREEN)]
for check in checks:
    try:
        check()
    except (ValueError,TypeError):
        pass
    else:
        raise AssertionError('Invalid expectation must fail')
`;
  const ts=`import {Decider,Driver,Simulation,WireColor,Port,wire} from 'circuit';import {Virtual} from 'catalog';
const gate=new Decider({name:'Gate',when:Virtual.A.greaterThan(0),outputs:[Virtual.B.output(1)]});
const source=new Driver({name:'Input',signals:[Virtual.A.output(2),Virtual.B.output(3),Virtual.A.withQuality('legendary').output(9)]});
wire(source,gate,{color:WireColor.GREEN});wire(source,gate,{color:WireColor.GREEN,targetPort:Port.OUTPUT});
const scenario=new Simulation({entities:[source,gate],ticks:4,name:'Gate checks'});
scenario.expect(0,gate,[Virtual.B.output(0)]).expect(1,gate,[Virtual.B.output(1),Virtual.C.output(0)]);
scenario.expect(4,gate,[Virtual.B.output(1)]);
scenario.expect(0,source,[Virtual.A.withQuality('legendary').output(9)]);
scenario.expect(1,gate,[Virtual.B.output(4)],{color:WireColor.GREEN,port:Port.OUTPUT});
scenario.expect(0,gate,[Virtual.A.output(2)],{color:WireColor.GREEN});
scenario.expect(0,source,[Virtual.A.output(2)],{color:WireColor.GREEN,port:Port.OUTPUT});
if(scenario.run().value(1,gate,Virtual.B)!==1)throw new Error('Snapshot mismatch');
const outside=new Driver({name:'Outside'});
const checks=[()=>scenario.expect(-1,gate,[Virtual.B.output(0)]),()=>scenario.expect(5,gate,[Virtual.B.output(0)]),()=>scenario.expect(0.5,gate,[Virtual.B.output(0)]),()=>scenario.expect(true,gate,[Virtual.B.output(0)]),()=>scenario.expect(0,outside,[Virtual.B.output(0)]),()=>scenario.expect(0,gate,[]),()=>scenario.expect(0,gate,[Virtual.each.output(1)]),()=>scenario.expect(0,gate,[Virtual.B.copyInput()]),()=>scenario.expect(0,gate,[Virtual.B.output(0)],{color:'blue'}),()=>scenario.expect(0,gate,[Virtual.B.output(0)],{port:Port.OUTPUT}),()=>scenario.expect(0,source,[Virtual.B.output(0)],{color:WireColor.GREEN})];
for(const check of checks){let threw=false;try{check();}catch{threw=true;}if(!threw)throw new Error('Invalid expectation must fail');}
`;
  for(const [language,code] of [['python',py],['typescript',ts]]){
    const worker=makeWorker(await workerBundle(language));
    const run=async suffix=>{worker.post({type:'run',code:code+suffix});return worker.wait(m=>['result','error'].includes(m.type));};
    try{
      await worker.wait(m=>m.type==='harness-loaded');
      worker.post({type:'init',...(language==='python'?{assets:await pythonAssets()}:{})});
      const ready=await worker.wait(m=>['ready','error'].includes(m.type));assert.equal(ready.type,'ready',ready.message);
      const success=await run('');assert.equal(success.type,'result',success.message);
      const suffixes=language==='python'?[
        `scenario.expect(1,gate,[Virtual.B.output(9)])`,
        `scenario.expect(1,gate,[Virtual.B.output(8)],color=WireColor.GREEN,port=Port.OUTPUT)`,
        `scenario.expect(0,source,[Virtual.A.with_quality('legendary').output(10)])`,
        `scenario.expect(4,gate,[Virtual.C.output(2)])`,
        `scenario.expect(1,gate,[Virtual.B.output(9)]).run()`,
      ]:[
        `scenario.expect(1,gate,[Virtual.B.output(9)]);`,
        `scenario.expect(1,gate,[Virtual.B.output(8)],{color:WireColor.GREEN,port:Port.OUTPUT});`,
        `scenario.expect(0,source,[Virtual.A.withQuality('legendary').output(10)]);`,
        `scenario.expect(4,gate,[Virtual.C.output(2)]);`,
        `scenario.expect(1,gate,[Virtual.B.output(9)]).run();`,
      ];
      const messages=[
        'Simulation "Gate checks", tick 1, "Gate" (entity 1) output: virtual:signal-B [normal] expected 9, got 1.',
        'Simulation "Gate checks", tick 1, "Gate" (entity 1) green output network: virtual:signal-B [normal] expected 8, got 4.',
        'Simulation "Gate checks", tick 0, "Input" (entity 2) output: virtual:signal-A [legendary] expected 10, got 9.',
        'Simulation "Gate checks", tick 4, "Gate" (entity 1) output: virtual:signal-C [normal] expected 2, got 0.',
      ];
      for(const [i,suffix]of suffixes.entries()){
        const failed=await run('\n'+suffix);assert.equal(failed.type,'error');
        assert.ok(failed.message.includes(messages[i%4]),failed.message);
      }
      const again=await run('');assert.equal(again.type,'result',again.message);
      assert.equal(again.simulations.length,1,'failed checks do not leak into subsequent runs');
    }finally{await worker.terminate();}
  }
});
