/**
 * Signed feedback memory
 *
 * Pulse signed A values into the red input. The green feedback loop accumulates them and holds any nonzero total. An opposite pulse of the current total clears it. This is an accumulator: a held value repeatedly adds rather than replacing memory.
 *
 * Simulation (34 ticks): Signed pulses move memory through 7, -3, 0, and -5. Unlike positive-only memory, a negative stored total survives.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Basic_memory
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Simulation, Driver, wire, WireColor } from "circuit";
import { Virtual } from "catalog";

const memory = new Decider({
  name: "Signed feedback memory",
  when: Virtual.A.notEquals(0),
  outputs: [Virtual.A.copyInput()],
});

const pulses = new Driver({ name: "pulses" });
pulses.pulse(2, [Virtual.A.output(7)]);
pulses.pulse(10, [Virtual.A.output(-10)]);
pulses.pulse(18, [Virtual.A.output(3)]);
pulses.pulse(26, [Virtual.A.output(-5)]);

wire(memory, memory, { color: WireColor.GREEN });
wire(pulses, memory);

const scenario = new Simulation({ entities: [memory, pulses], ticks: 34, name: "Signed feedback memory" });

// Run checks these signal expectations automatically.
scenario.expect(4, memory, [Virtual.A.output(7)]);
scenario.expect(12, memory, [Virtual.A.output(-3)]);
scenario.expect(20, memory, [Virtual.A.output(0)]);
scenario.expect(28, memory, [Virtual.A.output(-5)]);
