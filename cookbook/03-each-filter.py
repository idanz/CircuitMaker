"""Each filter

Input: mixed signed counts. Output: the positive signals with their original counts, one tick later. Each tests and copies every qualifying channel separately.

Simulation (26 ticks): The bus starts positive, changes to mixed positive/negative counts at tick 8, and clears at tick 16. Inspect the output one tick after each change.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Virtual_signals
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Decider, Simulation, Driver, wire
from catalog import Virtual

test = Decider(
    name="Each filter",
    when=Virtual.each.greater_than(0),
    outputs=[Virtual.each.copy_input()],
)

inputs = Driver("inputs")
inputs.at(0, [Virtual.A.output(4), Virtual.B.output(2)], reset_others=True)
inputs.at(8, [Virtual.A.output(-3), Virtual.B.output(2)], reset_others=True)
inputs.at(16, [], reset_others=True)

wire(inputs, test)

scenario = Simulation([test, inputs], ticks=26, name="Each filter")

# Run checks these signal expectations automatically.
scenario.expect(1, test, [Virtual.A.output(4)])
scenario.expect(9, test, [Virtual.A.output(0)])
scenario.expect(9, test, [Virtual.B.output(2)])
