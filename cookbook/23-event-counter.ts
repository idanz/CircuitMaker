/**
 * Pulse event counter
 *
 * Pulse N=1 on the red input once per event and leave it absent between events. The green loop accumulates signed N values. Read the green output for the count. Sending N=5 adds five, while holding N=1 counts ticks; neither is a replacement write.
 *
 * Simulation (36 ticks): Three unit N pulses are followed by +5 and -2. The stored count finishes at 6; absent input between events keeps the total steady.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Counter
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Simulation, Driver, wire, WireColor } from "circuit";
import { Virtual } from "catalog";

const counter = new Decider({
  name: "Pulse event counter",
  when: Virtual.N.notEquals(0),
  outputs: [Virtual.N.copyInput()],
});

const events = new Driver({ name: "events" });
events.pulse(2, [Virtual.N.output(1)]);
events.pulse(8, [Virtual.N.output(1)]);
events.pulse(14, [Virtual.N.output(1)]);
events.pulse(20, [Virtual.N.output(5)]);
events.pulse(28, [Virtual.N.output(-2)]);

wire(counter, counter, { color: WireColor.GREEN });
wire(events, counter);

const scenario = new Simulation({ entities: [counter, events], ticks: 36, name: "Pulse event counter" });

// Run checks these signal expectations automatically.
scenario.expect(16, counter, [Virtual.N.output(3)]);
scenario.expect(24, counter, [Virtual.N.output(8)]);
scenario.expect(32, counter, [Virtual.N.output(6)]);
