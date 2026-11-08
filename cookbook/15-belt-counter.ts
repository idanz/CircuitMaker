/**
 * Belt pulse counter
 *
 * Place items on the connected belt. It reads hand contents in pulse mode, adding each detected item once to its own signal count. The decider stores all nonzero item totals through its green feedback. Read the memory output; do not change the belt to hold mode, which would count the same item repeatedly.
 *
 * Device declarations here are source-only placeholders. Devices and their wires are omitted from every export; add and connect them manually in Factorio.
 *
 * Simulation (24 ticks): A Driver substitutes for belt pulse readings: two iron plates, three copper plates, then four more iron plates. Stored totals become iron=6 and copper=3.
 * Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
 * Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Basic_memory
 * Original CircuitMaker implementation and explanation; parameters are editable in a copy.
 */
import { Decider, Device, Simulation, Driver, wire, WireColor } from "circuit";
import { Items, Virtual } from "catalog";

const counter = new Decider({
  name: "Belt item counter",
  when: Virtual.anything.notEquals(0),
  outputs: [Virtual.everything.copyInput()],
});

const belt = new Device({
  name: "Pulse belt sensor",
  prototype: "transport-belt",
});

const belt_readings = new Driver({ name: "belt readings" });
belt_readings.pulse(2, [Items.ironPlate.output(2)]);
belt_readings.pulse(8, [Items.copperPlate.output(3)]);
belt_readings.pulse(14, [Items.ironPlate.output(4)]);

wire(belt, counter);
wire(counter, counter, { color: WireColor.GREEN });
wire(belt_readings, counter);

const scenario = new Simulation({ entities: [counter, belt_readings], ticks: 24, name: "Belt pulse counter" });

// Run checks these signal expectations automatically.
scenario.expect(5, counter, [Items.ironPlate.output(2)]);
scenario.expect(10, counter, [Items.copperPlate.output(3)]);
scenario.expect(17, counter, [Items.ironPlate.output(6)]);
