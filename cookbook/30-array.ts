/**
 * Indexed array lookup
 *
 * A constant maps four item channels to indices 1..4. X=3 selects express belts; the decider emits one unit of that channel as the dictionary mask. Read express belts=56 at the final red bus after the mask and multiplier settle. Read indices only on green so X cannot become an array element. Missing indices yield no output. Duplicate indices select multiple values.
 *
 * Simulation (44 ticks): X starts at 3. Driver offsets select index 1 at tick 8, index 4 at 16, a missing index at 24, and index 3 again at 32. Allow the lookup pipeline to settle.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Multiplier_and_Dictionaries/Arrays
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Arithmetic, Constant, Decider, Operation, Simulation, Driver, wire, WireColor, Port } from "circuit";
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

const values = new Constant({
  name: "Array values",
  outputs: [Items.transportBelt.output(12), Items.fastTransportBelt.output(34), Items.expressTransportBelt.output(56), Items.burnerInserter.output(78)],
});

const mapping = new Constant({
  name: "Signal to array index",
  outputs: [Items.transportBelt.output(1), Items.fastTransportBelt.output(2), Items.expressTransportBelt.output(3), Items.burnerInserter.output(4)],
});

const index = new Constant({
  name: "Select index 3",
  outputs: [Virtual.X.output(3)],
});

const mask = new Decider({
  name: "Index to one-hot mask",
  when: Virtual.each.red.equals(Virtual.X.green),
  outputs: [Virtual.each.red.output(1)],
});

const index_changes = new Driver({ name: "index changes" });
index_changes.at(8, [Virtual.X.output(-2)], true);
index_changes.at(16, [Virtual.X.output(1)], true);
index_changes.at(24, [Virtual.X.output(6)], true);
index_changes.at(32, [], true);

wire(isolate, difference_square);
wire(negate, difference_square, { color: WireColor.GREEN });
wire(sum, sum_square);
wire(difference_square, negative_quarter);
wire(sum_square, positive_quarter);
wire(negative_quarter, positive_quarter, { targetPort: Port.OUTPUT });
wire(mapping, mask);
wire(index, mask, { color: WireColor.GREEN });
wire(values, isolate);
wire(values, sum);
wire(mask, sum, { color: WireColor.GREEN });
wire(mask, negate, { color: WireColor.GREEN });
wire(index_changes, mask, { color: WireColor.GREEN });

const scenario = new Simulation({ entities: [isolate, sum, negate, difference_square, sum_square, negative_quarter, positive_quarter, values, mapping, index, mask, index_changes], ticks: 44, name: "Indexed array lookup" });

// Run checks these signal expectations automatically.
scenario.expect(6, positive_quarter, [Items.expressTransportBelt.output(56)], { color: WireColor.RED, port: Port.OUTPUT });
scenario.expect(14, positive_quarter, [Items.transportBelt.output(12)], { color: WireColor.RED, port: Port.OUTPUT });
scenario.expect(22, positive_quarter, [Items.burnerInserter.output(78)], { color: WireColor.RED, port: Port.OUTPUT });
scenario.expect(30, positive_quarter, [Items.burnerInserter.output(0)], { color: WireColor.RED, port: Port.OUTPUT });
scenario.expect(38, positive_quarter, [Items.expressTransportBelt.output(56)], { color: WireColor.RED, port: Port.OUTPUT });
