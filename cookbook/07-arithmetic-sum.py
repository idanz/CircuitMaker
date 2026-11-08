"""Arithmetic Each reduction

Input: any signal bus. Output: A is twice the sum of all input counts. Each on the left and a named output reduces the mapped values into one signal.

Simulation (26 ticks): The bus starts positive, changes to mixed positive/negative counts at tick 8, and clears at tick 16. Inspect the output one tick after each change.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Virtual_signals
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Arithmetic, Operation, Simulation, Driver, wire
from catalog import Virtual

sum = Arithmetic(
    name="Sum doubled channels",
    left=Virtual.each,
    operation=Operation.MULTIPLY,
    right=2,
    output=Virtual.A,
)

inputs = Driver("inputs")
inputs.at(0, [Virtual.A.output(4), Virtual.B.output(2)], reset_others=True)
inputs.at(8, [Virtual.A.output(-3), Virtual.B.output(2)], reset_others=True)
inputs.at(16, [], reset_others=True)

wire(inputs, sum)

scenario = Simulation([sum, inputs], ticks=26, name="Arithmetic Each reduction")

# Run checks these signal expectations automatically.
scenario.expect(1, sum, [Virtual.A.output(12)])
scenario.expect(9, sum, [Virtual.A.output(-2)])
