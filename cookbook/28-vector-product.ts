/**
 * Per-signal vector multiplication
 *
 * Two example vectors enter the red A and green B stage-one inputs. After three combinator stages, read the joined final red output: iron plates 24 and copper plates -6. The circuit computes ((A+B)^2-(A-B)^2)/4 per channel. Keep |A+B| and |A-B| at most 46340 so the squared intermediates fit int32. Separate integer divisions cancel matching remainders.
 *
 * Simulation (16 ticks): The bundled constant vectors settle through the arithmetic pipeline. Read the joined final red bus: iron plates=24 and copper plates=-6.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Multiplier_and_Dictionaries/Arrays
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Arithmetic, Constant, Operation, Simulation, wire, WireColor, Port } from "circuit";
import { Items, Virtual } from "catalog";

const isolate = new Arithmetic({
  name: "Vector product: isolate A",
  left: Virtual.each.red,
  operation: Operation.ADD,
  right: 0,
  output: Virtual.each,
});

const sum = new Arithmetic({
  name: "Add vectors",
  left: Virtual.each,
  operation: Operation.ADD,
  right: 0,
  output: Virtual.each,
});

const negate = new Arithmetic({
  name: "Negate B",
  left: Virtual.each.green,
  operation: Operation.MULTIPLY,
  right: -1,
  output: Virtual.each,
});

const difference_square = new Arithmetic({
  name: "Square A minus B",
  left: Virtual.each,
  operation: Operation.POWER,
  right: 2,
  output: Virtual.each,
});

const sum_square = new Arithmetic({
  name: "Square A plus B",
  left: Virtual.each,
  operation: Operation.POWER,
  right: 2,
  output: Virtual.each,
});

const negative_quarter = new Arithmetic({
  name: "Subtract difference square",
  left: Virtual.each,
  operation: Operation.DIVIDE,
  right: -4,
  output: Virtual.each,
});

const positive_quarter = new Arithmetic({
  name: "Add sum square",
  left: Virtual.each,
  operation: Operation.DIVIDE,
  right: 4,
  output: Virtual.each,
});

const vector_a = new Constant({
  name: "Sample A",
  outputs: [Items.ironPlate.output(6), Items.copperPlate.output(3)],
});

const vector_b = new Constant({
  name: "Sample B",
  outputs: [Items.ironPlate.output(4), Items.copperPlate.output(-2)],
});

wire(isolate, difference_square);
wire(negate, difference_square, { color: WireColor.GREEN });
wire(sum, sum_square);
wire(difference_square, negative_quarter);
wire(sum_square, positive_quarter);
wire(negative_quarter, positive_quarter, { targetPort: Port.OUTPUT });
wire(vector_a, isolate);
wire(vector_a, sum);
wire(vector_b, sum, { color: WireColor.GREEN });
wire(vector_b, negate, { color: WireColor.GREEN });

const scenario = new Simulation({ entities: [isolate, sum, negate, difference_square, sum_square, negative_quarter, positive_quarter, vector_a, vector_b], ticks: 16, name: "Per-signal vector multiplication" });

// Run checks these signal expectations automatically.
scenario.expect(10, positive_quarter, [Items.ironPlate.output(24)], { color: WireColor.RED, port: Port.OUTPUT });
scenario.expect(10, positive_quarter, [Items.copperPlate.output(-6)], { color: WireColor.RED, port: Port.OUTPUT });
