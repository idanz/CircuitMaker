/**
 * Positive feedback memory
 *
 * Pulse a positive A into the red input for one tick, then remove it. The green loop stores the running total while it is positive. A negative pulse subtracts; a total at or below zero clears the stored output. A continuously held input adds on every tick.
 *
 * Simulation (34 ticks): One-tick A pulses add 7, subtract 3, clear the remaining 4, and store 5. Read the green memory output between pulses.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Basic_memory
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Simulation, Driver, wire, WireColor } from "circuit";
import { Virtual } from "catalog";

const memory = new Decider({
  name: "Positive feedback memory",
  when: Virtual.A.greaterThan(0),
  outputs: [Virtual.A.copyInput()],
});

const pulses = new Driver({ name: "pulses" });
pulses.pulse(2, [Virtual.A.output(7)]);
pulses.pulse(10, [Virtual.A.output(-3)]);
pulses.pulse(18, [Virtual.A.output(-4)]);
pulses.pulse(26, [Virtual.A.output(5)]);

wire(memory, memory, { color: WireColor.GREEN });
wire(pulses, memory);

const scenario = new Simulation({ entities: [memory, pulses], ticks: 34, name: "Positive feedback memory" });

// Run checks these signal expectations automatically.
scenario.expect(4, memory, [Virtual.A.output(7)]);
scenario.expect(12, memory, [Virtual.A.output(4)]);
scenario.expect(20, memory, [Virtual.A.output(0)]);
scenario.expect(28, memory, [Virtual.A.output(5)]);
