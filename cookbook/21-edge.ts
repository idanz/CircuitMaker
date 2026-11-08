/**
 * Signed edge detector
 *
 * Feed A into the source. The source output joins the delayed negation output on green; read that green bus for current-minus-previous A. A 0→1 change produces +1 for a tick, and 1→0 produces -1. The source isolator contributes one tick of delay.
 *
 * Simulation (55 ticks): A changes 0 to 1 at tick 5, falls at 15, rises to 4 at 25, drops to 1 at 35, and clears at 45. Compare signed deltas with rising-only events.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Edge_detectors
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Arithmetic, Operation, Simulation, Driver, wire, WireColor, Port } from "circuit";
import { Virtual } from "catalog";

const source = new Arithmetic({
  name: "Signed edge detector",
  left: Virtual.A,
  operation: Operation.ADD,
  right: 0,
  output: Virtual.A,
});

const delay = new Arithmetic({
  name: "Delayed negation",
  left: Virtual.A,
  operation: Operation.MULTIPLY,
  right: -1,
  output: Virtual.A,
});

const inputs = new Driver({ name: "inputs" });
inputs.at(5, [Virtual.A.output(1)], true);
inputs.at(15, [], true);
inputs.at(25, [Virtual.A.output(4)], true);
inputs.at(35, [Virtual.A.output(1)], true);
inputs.at(45, [], true);

wire(source, delay);
wire(source, delay, { color: WireColor.GREEN, targetPort: Port.OUTPUT });
wire(inputs, source);

const scenario = new Simulation({ entities: [source, delay, inputs], ticks: 55, name: "Signed edge detector" });

// Run checks these signal expectations automatically.
scenario.expect(6, source, [Virtual.A.output(1)], { color: WireColor.GREEN, port: Port.OUTPUT });
scenario.expect(16, source, [Virtual.A.output(-1)], { color: WireColor.GREEN, port: Port.OUTPUT });
scenario.expect(26, source, [Virtual.A.output(4)], { color: WireColor.GREEN, port: Port.OUTPUT });
scenario.expect(36, source, [Virtual.A.output(-3)], { color: WireColor.GREEN, port: Port.OUTPUT });
