/**
 * Signed value cell
 *
 * Write signed nonzero I at the first arithmetic input. Read M on the red output bus at the storage decider. Reset R connects ONLY to that decider input on red; keep it off the green write-control bus. A one-tick write survives. Reset clears an idle cell. The write path normally wins during a simultaneous write/reset, but opposing R counts can cancel: schedule resets while I is zero. Allow the three-stage pipeline to settle and keep unrelated R off both buses.
 *
 * Simulation (46 ticks): One-tick writes store -8, then 5, then -3. A separate reset Driver clears idle storage at ticks 22 and 38. Read M at the hold decider output.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Memory_cells
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Arithmetic, Decider, Operation, Simulation, Driver, wire, WireColor, Port } from "circuit";
import { Virtual } from "catalog";

const write = new Arithmetic({
  name: "Signed value cell",
  left: Virtual.I,
  operation: Operation.MULTIPLY,
  right: 1,
  output: Virtual.R,
});

const rename = new Arithmetic({
  name: "Rename write to M",
  left: Virtual.R,
  operation: Operation.MULTIPLY,
  right: 1,
  output: Virtual.M,
});

const hold = new Decider({
  name: "Hold while no write or reset",
  when: Virtual.R.equals(0),
  outputs: [Virtual.M.copyInput()],
});

const writes = new Driver({ name: "writes" });
writes.pulse(2, [Virtual.I.output(-8)]);
writes.pulse(12, [Virtual.I.output(5)]);
writes.pulse(30, [Virtual.I.output(-3)]);

const resets = new Driver({ name: "resets" });
resets.pulse(22, [Virtual.R.output(1)], 2);
resets.pulse(38, [Virtual.R.output(1)], 2);

wire(write, rename, { color: WireColor.GREEN });
wire(rename, hold, { color: WireColor.GREEN, sourcePort: Port.INPUT });
wire(rename, hold);
wire(hold, hold);
wire(writes, write);
wire(resets, hold);

const scenario = new Simulation({ entities: [write, rename, hold, writes, resets], ticks: 46, name: "Signed value cell" });

// Run checks these signal expectations automatically.
scenario.expect(8, hold, [Virtual.M.output(-8)]);
scenario.expect(18, hold, [Virtual.M.output(5)]);
scenario.expect(28, hold, [Virtual.M.output(0)]);
scenario.expect(36, hold, [Virtual.M.output(-3)]);
scenario.expect(44, hold, [Virtual.M.output(0)]);
