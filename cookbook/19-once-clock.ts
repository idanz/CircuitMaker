/**
 * One-time clock
 *
 * This recreates the tutorial feedback topology: the tick decider emits T=1 while T<Z; the storage decider holds T while R=0. Z is 180. Reset is initially disabled: enable its constant in-game briefly, then disable it. Observe both networks when stepping; the tick and storage stages introduce a pipeline delay.
 *
 * Simulation (430 ticks): The clock reaches its target and holds. A reset Driver injects R for four ticks starting at 230, then the clock runs to the target again.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Basic_clocks
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Constant, Simulation, Driver, wire, WireColor } from "circuit";
import { Virtual } from "catalog";

const tick = new Decider({
  name: "One-time clock",
  when: Virtual.T.lessThan(Virtual.Z),
  outputs: [Virtual.T.output(1)],
});

const limit = new Constant({
  name: "Target Z=180",
  outputs: [Virtual.Z.output(180)],
});

const reset = new Constant({
  name: "Enable to reset",
  outputs: [Virtual.R.output(1)],
  enabled: false,
});

const hold = new Decider({
  name: "Clock storage",
  when: Virtual.R.equals(0),
  outputs: [Virtual.T.copyInput()],
});

const reset_pulse = new Driver({ name: "reset pulse" });
reset_pulse.pulse(230, [Virtual.R.output(1)], 4);

wire(limit, tick, { color: WireColor.GREEN });
wire(reset, hold, { color: WireColor.GREEN });
wire(tick, hold);
wire(hold, tick);
wire(hold, hold, { color: WireColor.GREEN });
wire(reset_pulse, hold, { color: WireColor.GREEN });

const scenario = new Simulation({ entities: [tick, limit, reset, hold, reset_pulse], ticks: 430, name: "One-time clock" });

// Run checks these signal expectations automatically.
scenario.expect(220, hold, [Virtual.T.output(181)]);
scenario.expect(240, hold, [Virtual.T.output(6)]);
scenario.expect(430, hold, [Virtual.T.output(181)]);
