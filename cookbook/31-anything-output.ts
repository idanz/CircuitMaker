/**
 * Anything output selector
 *
 * Input: a mixed bus. Output: one qualifying positive signal with its original count. Anything as an output selects a matching channel; do not rely on its iteration order when several qualify. Empty input yields no output.
 *
 * Simulation (34 ticks): Only one input channel is present at a time: A=7 at tick 2, empty at 10, B=3 at 18, empty at 26. This avoids ambiguous Anything selection ordering; multiple output candidates are not yet supported by the simulator.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Virtual_signals
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Simulation, Driver, wire } from "circuit";
import { Virtual } from "catalog";

const selector = new Decider({
  name: "Anything output selector",
  when: Virtual.anything.greaterThan(0),
  outputs: [Virtual.anything.copyInput()],
});

const inputs = new Driver({ name: "inputs" });
inputs.at(2, [Virtual.A.output(7)], true);
inputs.at(10, [], true);
inputs.at(18, [Virtual.B.output(3)], true);
inputs.at(26, [], true);

wire(inputs, selector);

const scenario = new Simulation({ entities: [selector, inputs], ticks: 34, name: "Anything output selector" });

// Run checks these signal expectations automatically.
scenario.expect(3, selector, [Virtual.A.output(7)]);
scenario.expect(11, selector, [Virtual.A.output(0)]);
scenario.expect(19, selector, [Virtual.B.output(3)]);
scenario.expect(27, selector, [Virtual.B.output(0)]);
