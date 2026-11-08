/**
 * Single combinator clock
 *
 * Both outputs share the C<59 condition: copied C plus fixed C=1. When the condition fails both stop, producing zero for one tick. The green feedback therefore cycles 0..59, giving a 60-tick period without an external constant. This differs from the constant-fed clock, whose input bus never reaches zero.
 *
 * Simulation (125 ticks): The timeline covers two complete 60-tick cycles, including the zero tick when both C outputs stop.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Basic_clocks
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Simulation, wire, WireColor } from "circuit";
import { Virtual } from "catalog";

const clock = new Decider({
  name: "Single combinator clock",
  when: Virtual.C.lessThan(59),
  outputs: [Virtual.C.copyInput(), Virtual.C.output(1)],
});

wire(clock, clock, { color: WireColor.GREEN });

const scenario = new Simulation({ entities: [clock], ticks: 125, name: "Single combinator clock" });

// Run checks these signal expectations automatically.
scenario.expect(59, clock, [Virtual.C.output(59)]);
scenario.expect(60, clock, [Virtual.C.output(0)]);
scenario.expect(61, clock, [Virtual.C.output(1)]);
