// Run to build the circuit and inspect its Simulation timeline.
import { Decider, Driver, Simulation, WireColor, wire } from 'circuit';
import { Virtual } from 'catalog';

const gate = new Decider({
  name: 'Simple gate',
  when: Virtual.A.greaterThan(0),
  outputs: [Virtual.B.output(1)],
});

// Hold A from tick 10 through 29. The gate outputs B one tick later.
const source = new Driver({ name: 'Input' }).at(10, [Virtual.A.output(1)]).at(30, [], true);
wire(source, gate, { color: WireColor.GREEN });
const scenario = new Simulation({ entities: [gate, source], ticks: 50, name: 'Simple gate' });
// Run checks these expectations and reports expected versus actual counts.
scenario.expect(10, gate, [Virtual.B.output(0)]); // One tick delay.
scenario.expect(11, gate, [Virtual.B.output(1)]); // Gate opens.
scenario.expect(31, gate, [Virtual.B.output(0)]); // Gate closes.
