/**
 * Conditional bus gate
 *
 * Feed the data and an enable channel E into the input. When E is positive, all input channels, including E, are copied one tick later. When E is absent or nonpositive the gate emits nothing. Keep input and output networks separate.
 *
 * Simulation (32 ticks): E enables the data bus at ticks 0 and 16, disables it at tick 8, and the source clears at tick 24.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Input_insulator_&_gate
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Simulation, Driver, wire } from "circuit";
import { Virtual } from "catalog";

const gate = new Decider({
  name: "Enabled bus gate",
  when: Virtual.E.greaterThan(0),
  outputs: [Virtual.everything.copyInput()],
});

const inputs = new Driver({ name: "inputs" });
inputs.at(0, [Virtual.A.output(5), Virtual.E.output(1)], true);
inputs.at(8, [Virtual.A.output(5)], true);
inputs.at(16, [Virtual.A.output(8), Virtual.E.output(1)], true);
inputs.at(24, [], true);

wire(inputs, gate);

const scenario = new Simulation({ entities: [gate, inputs], ticks: 32, name: "Conditional bus gate" });

// Run checks these signal expectations automatically.
scenario.expect(1, gate, [Virtual.A.output(5)]);
scenario.expect(9, gate, [Virtual.A.output(0)]);
scenario.expect(17, gate, [Virtual.A.output(8)]);
