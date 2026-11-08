/**
 * Biased SR switch
 *
 * External input: A. Output: S=1 after A reaches 100. Feedback adds 60 to A while active, so the switch stays on until A drops below 40. The feedback path adds two ticks of latency; hold set/reset inputs until it settles. Read S at the decider output.
 *
 * Simulation (55 ticks): A crosses 100, falls to 60 (held on), falls below 40 (off), then sets and resets again. Read S after the two-stage feedback settles.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Set/Reset_latching_switch
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Arithmetic, Operation, Simulation, Driver, wire, WireColor } from "circuit";
import { Virtual } from "catalog";

const latch = new Decider({
  name: "Biased SR switch",
  when: Virtual.A.atLeast(100),
  outputs: [Virtual.S.output(1)],
});

const bias = new Arithmetic({
  name: "Hold bias 60",
  left: Virtual.S,
  operation: Operation.MULTIPLY,
  right: 60,
  output: Virtual.A,
});

const inputs = new Driver({ name: "inputs" });
inputs.at(5, [Virtual.A.output(110)], true);
inputs.at(15, [Virtual.A.output(60)], true);
inputs.at(25, [Virtual.A.output(39)], true);
inputs.at(35, [Virtual.A.output(100)], true);
inputs.at(45, [], true);

wire(latch, bias);
wire(bias, latch, { color: WireColor.GREEN });
wire(inputs, latch);

const scenario = new Simulation({ entities: [latch, bias, inputs], ticks: 55, name: "Biased SR switch" });

// Run checks these signal expectations automatically.
scenario.expect(8, latch, [Virtual.S.output(1)]);
scenario.expect(18, latch, [Virtual.S.output(1)]);
scenario.expect(28, latch, [Virtual.S.output(0)]);
scenario.expect(38, latch, [Virtual.S.output(1)]);
scenario.expect(48, latch, [Virtual.S.output(0)]);
