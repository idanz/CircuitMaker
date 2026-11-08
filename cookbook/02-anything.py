"""Anything wildcard

Input: any signal bus. Output: A=1, one tick later, if at least one present count is positive. Empty input produces no A. This is useful as a busy flag.

Simulation (26 ticks): The bus starts positive, changes to mixed positive/negative counts at tick 8, and clears at tick 16. Inspect the output one tick after each change.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Virtual_signals
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Decider, Simulation, Driver, wire
from catalog import Virtual

test = Decider(
    name="Anything wildcard",
    when=Virtual.anything.greater_than(0),
    outputs=[Virtual.A.output(1)],
)

inputs = Driver("inputs")
inputs.at(0, [Virtual.A.output(4), Virtual.B.output(2)], reset_others=True)
inputs.at(8, [Virtual.A.output(-3), Virtual.B.output(2)], reset_others=True)
inputs.at(16, [], reset_others=True)

wire(inputs, test)

scenario = Simulation([test, inputs], ticks=26, name="Anything wildcard")

# Run checks these signal expectations automatically.
scenario.expect(1, test, [Virtual.A.output(1)])
scenario.expect(9, test, [Virtual.A.output(1)])
scenario.expect(17, test, [Virtual.A.output(0)])
