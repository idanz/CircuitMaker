/**
 * Arithmetic Each map
 *
 * Input: any signal bus. Output: every count multiplied by two after one tick. Each on both sides preserves the signal names. Arithmetic uses signed 32-bit counts; overflow wraps.
 *
 * Simulation (26 ticks): The bus starts positive, changes to mixed positive/negative counts at tick 8, and clears at tick 16. Inspect the output one tick after each change.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Virtual_signals
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Arithmetic, Operation, Simulation, Driver, wire } from "circuit";
import { Virtual } from "catalog";

const scale = new Arithmetic({
  name: "Double each channel",
  left: Virtual.each,
  operation: Operation.MULTIPLY,
  right: 2,
  output: Virtual.each,
});

const inputs = new Driver({ name: "inputs" });
inputs.at(0, [Virtual.A.output(4), Virtual.B.output(2)], true);
inputs.at(8, [Virtual.A.output(-3), Virtual.B.output(2)], true);
inputs.at(16, [], true);

wire(inputs, scale);

const scenario = new Simulation({ entities: [scale, inputs], ticks: 26, name: "Arithmetic Each map" });

// Run checks these signal expectations automatically.
scenario.expect(1, scale, [Virtual.A.output(8)]);
scenario.expect(9, scale, [Virtual.A.output(-6)]);
scenario.expect(9, scale, [Virtual.B.output(4)]);
