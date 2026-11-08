/**
 * Runaway arithmetic clock
 *
 * No external input is needed. The combinator adds one to C each tick and feeds the result back. Read its green output. It has no automatic reset and wraps at the signed 32-bit boundary. Adding other C counts changes the rate.
 *
 * Simulation (45 ticks): No external input is needed. Watch C increase by one each tick on the feedback output.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Basic_clocks
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Arithmetic, Operation, Simulation, wire, WireColor } from "circuit";
import { Virtual } from "catalog";

const clock = new Arithmetic({
  name: "Runaway arithmetic clock",
  left: Virtual.C,
  operation: Operation.ADD,
  right: 1,
  output: Virtual.C,
});

wire(clock, clock, { color: WireColor.GREEN });

const scenario = new Simulation({ entities: [clock], ticks: 45, name: "Runaway arithmetic clock" });

// Run checks these signal expectations automatically.
scenario.expect(10, clock, [Virtual.C.output(10)]);
scenario.expect(30, clock, [Virtual.C.output(30)]);
