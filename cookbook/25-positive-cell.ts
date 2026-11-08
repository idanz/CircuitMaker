/**
 * Positive value cell
 *
 * Feed I on the red input bus shared by both deciders. Positive I passes as I; after removal, M carries the remembered value. Read the red bus at the arithmetic input, where the two decider outputs merge. Negative I clears the memory after the pipeline settles. Hold writes for multiple ticks: a one-tick write can alternate between two old values.
 *
 * Simulation (44 ticks): Hold I=9 for six ticks, release it, then write 4. A held negative I clears memory at tick 30. Read M at the arithmetic input after settling.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Memory_cells
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Arithmetic, Operation, Simulation, Driver, wire, Port, WireColor } from "circuit";
import { Virtual } from "catalog";

const write_gate = new Decider({
  name: "Positive value cell",
  when: Virtual.I.greaterThan(0),
  outputs: [Virtual.I.copyInput()],
});

const hold = new Decider({
  name: "Read remembered value",
  when: Virtual.I.equals(0),
  outputs: [Virtual.M.copyInput()],
});

const rename = new Arithmetic({
  name: "Store as M",
  left: Virtual.M,
  operation: Operation.ADD,
  right: Virtual.I,
  output: Virtual.M,
});

const writes = new Driver({ name: "writes" });
writes.at(2, [Virtual.I.output(9)], true);
writes.at(8, [], true);
writes.at(16, [Virtual.I.output(4)], true);
writes.at(22, [], true);
writes.at(30, [Virtual.I.output(-1)], true);
writes.at(34, [], true);

wire(write_gate, hold, { sourcePort: Port.INPUT });
wire(write_gate, rename);
wire(hold, rename);
wire(rename, hold, { color: WireColor.GREEN });
wire(writes, write_gate);

const scenario = new Simulation({ entities: [write_gate, hold, rename, writes], ticks: 44, name: "Positive value cell" });

// Run checks these signal expectations automatically.
scenario.expect(14, rename, [Virtual.M.output(9)], { color: WireColor.RED, port: Port.INPUT });
scenario.expect(28, rename, [Virtual.M.output(4)], { color: WireColor.RED, port: Port.INPUT });
scenario.expect(42, rename, [Virtual.M.output(0)], { color: WireColor.RED, port: Port.INPUT });
