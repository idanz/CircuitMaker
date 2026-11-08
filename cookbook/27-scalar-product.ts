/**
 * Scalar multiplication
 *
 * Feed counts on A and B. The output P is A×B one tick later. Absent operands read as zero. Counts use signed 32-bit integer arithmetic, so large products wrap. This handles two named channels, unlike the per-channel vector circuit.
 *
 * Simulation (32 ticks): Inputs demonstrate 3x4, -2x5, a missing B operand, and 2x-3. Read P one tick after each change.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Multiplier_and_Dictionaries/Arrays
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Arithmetic, Operation, Simulation, Driver, wire } from "circuit";
import { Virtual } from "catalog";

const product = new Arithmetic({
  name: "Scalar multiplication",
  left: Virtual.A,
  operation: Operation.MULTIPLY,
  right: Virtual.B,
  output: Virtual.P,
});

const inputs = new Driver({ name: "inputs" });
inputs.at(0, [Virtual.A.output(3), Virtual.B.output(4)], true);
inputs.at(8, [Virtual.A.output(-2), Virtual.B.output(5)], true);
inputs.at(16, [Virtual.A.output(7)], true);
inputs.at(24, [Virtual.A.output(2), Virtual.B.output(-3)], true);

wire(inputs, product);

const scenario = new Simulation({ entities: [product, inputs], ticks: 32, name: "Scalar multiplication" });

// Run checks these signal expectations automatically.
scenario.expect(1, product, [Virtual.P.output(12)]);
scenario.expect(9, product, [Virtual.P.output(-10)]);
scenario.expect(17, product, [Virtual.P.output(0)]);
scenario.expect(25, product, [Virtual.P.output(-6)]);
