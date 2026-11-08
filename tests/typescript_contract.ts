// Compatibility contract: expected JSON comes from python_reference.py.
// Add the semantic assertions on the Python side; keep this port small.
import { Blueprint, Decider, EACH, allOf, anyOf, fluid, item, virtual } from 'circuit';

const [A, B, C, D] = ['A', 'B', 'C', 'D'].map(virtual);
const nested = allOf(anyOf(A.greaterThan(0), B.greaterThan(0)),
  anyOf(C.greaterThan(0), D.greaterThan(0)));
const iron = item('iron-plate');
const legendary = iron.withQuality('legendary');
export const contract = new Blueprint([
  new Decider({ name: 'Nested conditions', when: nested, outputs: [A.output(1)] }),
  new Decider({ name: 'Wire and quality', when: legendary.red.lessThan(iron.green),
    outputs: [legendary.red.copyInput(), fluid('water').green.output(-1)] }),
  new Decider({ name: 'Integer bounds', when: allOf(A.atLeast(-(2 ** 31)), B.atMost(2 ** 31 - 1)),
    outputs: [C.output(2 ** 31 - 1), D.output(-(2 ** 31))] }),
  new Decider({ name: 'Each input', when: EACH.red.atLeast(1), outputs: [EACH.red.copyInput()] }),
], 'Shared circuit contract');
