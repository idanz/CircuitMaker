import { Blueprint, Decider, Driver, Simulation, WireColor, wire, type Signal } from 'circuit';
import { Items, Virtual } from 'catalog';

function makeRule(signal: Signal, minimum: number): Decider {
  return new Decider({
    name: `Check ${signal.name}`,
    when: signal.green.atLeast(minimum),
    outputs: [Virtual.A.output(1)],
  });
}

const settings: [Signal, number][] = [
  [Items.ironPlate, 100],
  [Items.copperPlate, 200],
  [Items.steelPlate, 50],
];

export const blueprint = new Blueprint(
  settings.map(([signal, minimum]) => makeRule(signal, minimum)),
  'Supply generator',
);

console.log(`Generated ${settings.length} deciders.`);

// Below threshold at tick 5, sufficient supply at 15, empty again at 25.
const source = new Driver({ name: 'Supply levels' });
source.at(5, settings.map(([signal, minimum]) => signal.output(minimum - 1)));
source.at(15, settings.map(([signal, minimum]) => signal.output(minimum)));
source.at(25, [], true);
for (const rule of blueprint.deciders) wire(source, rule, { color: WireColor.GREEN });
const scenario = new Simulation({ entities: [...blueprint.deciders, source], ticks: 35, name: 'Supply thresholds' });
// Every rule is checked when Run calculates the simulation.
for (const rule of blueprint.deciders) {
  scenario.expect(6, rule, [Virtual.A.output(0)]);  // Below threshold.
  scenario.expect(15, rule, [Virtual.A.output(0)]); // One tick delay.
  scenario.expect(16, rule, [Virtual.A.output(1)]); // Threshold reached.
  scenario.expect(26, rule, [Virtual.A.output(0)]); // Supply cleared.
}
