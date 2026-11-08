/**
 * Light oil pump hysteresis
 *
 * Connect tank light-oil counts to the latch input with red wire. The pump enables at 20000 and holds while the tank is at least 5000; it disables below 5000 after feedback settles. The inclusive comparator means exactly 5000 remains enabled. Attach the pump to pipes in-game; this blueprint supplies its circuit control.
 *
 * Device declarations here are source-only placeholders. Devices and their wires are omitted from every export; add and connect them manually in Factorio.
 *
 * Simulation (65 ticks): A Driver stands in for the tank: oil rises to 22000, drops through 10000 and 5000, then below 5000. Read S; the pump placeholder itself is not simulated.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Set/Reset_latching_switch
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Arithmetic, Device, Operation, Simulation, Driver, wire, WireColor } from "circuit";
import { Fluids, Virtual } from "catalog";

const latch = new Decider({
  name: "Light oil pump hysteresis",
  when: Fluids.lightOil.atLeast(20000),
  outputs: [Virtual.S.output(1)],
});

const bias = new Arithmetic({
  name: "Light oil hold bias",
  left: Virtual.S,
  operation: Operation.MULTIPLY,
  right: 15000,
  output: Fluids.lightOil,
});

const pump = new Device({
  name: "Controlled pump",
  prototype: "pump",
  when: Virtual.S.greaterThan(0),
});

const tank = new Driver({ name: "tank" });
tank.at(5, [Fluids.lightOil.output(22000)], true);
tank.at(15, [Fluids.lightOil.output(10000)], true);
tank.at(25, [Fluids.lightOil.output(5000)], true);
tank.at(35, [Fluids.lightOil.output(4999)], true);
tank.at(45, [Fluids.lightOil.output(25000)], true);
tank.at(55, [], true);

wire(latch, bias);
wire(bias, latch, { color: WireColor.GREEN });
wire(latch, pump);
wire(tank, latch);

const scenario = new Simulation({ entities: [latch, bias, tank], ticks: 65, name: "Light oil pump hysteresis" });

// Run checks these signal expectations automatically.
scenario.expect(8, latch, [Virtual.S.output(1)]);
scenario.expect(18, latch, [Virtual.S.output(1)]);
scenario.expect(28, latch, [Virtual.S.output(1)]);
scenario.expect(38, latch, [Virtual.S.output(0)]);
scenario.expect(48, latch, [Virtual.S.output(1)]);
scenario.expect(58, latch, [Virtual.S.output(0)]);
