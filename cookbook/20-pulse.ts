/**
 * Periodic pulse generator
 *
 * The clock input bus cycles C=1..30. A second decider detects C=30 and emits P=1 for one tick, delayed by its evaluation. The lamp follows P with its own circuit evaluation. Pulses repeat every 30 ticks (0.5 seconds at 60 TPS); pulse width is one tick, not 1/30 second.
 *
 * Device declarations here are source-only placeholders. Devices and their wires are omitted from every export; add and connect them manually in Factorio.
 *
 * Simulation (95 ticks): The existing constant runs the clock for three cycles. Inspect P at the pulse decider output; each pulse lasts one tick. The lamp is a source-only placeholder.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Pulse_generators
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Constant, Device, Simulation, wire, Port } from "circuit";
import { Virtual } from "catalog";

const clock = new Decider({
  name: "Periodic pulse generator",
  when: Virtual.C.lessThan(30),
  outputs: [Virtual.C.copyInput()],
});

const step = new Constant({
  name: "Clock increment",
  outputs: [Virtual.C.output(1)],
});

const pulse = new Decider({
  name: "End-of-cycle pulse",
  when: Virtual.C.equals(30),
  outputs: [Virtual.P.output(1)],
});

const lamp = new Device({
  name: "Pulse indicator",
  prototype: "small-lamp",
  when: Virtual.P.greaterThan(0),
});

wire(step, clock);
wire(clock, clock);
wire(clock, pulse, { sourcePort: Port.INPUT });
wire(pulse, lamp);

const scenario = new Simulation({ entities: [clock, step, pulse], ticks: 95, name: "Periodic pulse generator" });

// Run checks these signal expectations automatically.
scenario.expect(30, pulse, [Virtual.P.output(1)]);
scenario.expect(31, pulse, [Virtual.P.output(0)]);
scenario.expect(60, pulse, [Virtual.P.output(1)]);
scenario.expect(90, pulse, [Virtual.P.output(1)]);
