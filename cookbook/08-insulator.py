"""Input insulator

Attach the upstream bus to the input and a separate downstream bus to the output. Counts cross with a one-tick delay. Downstream feedback cannot travel backwards through this arithmetic operation; either wire color can be used on each side.

Simulation (26 ticks): The bus starts positive, changes to mixed positive/negative counts at tick 8, and clears at tick 16. Inspect the output one tick after each change.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Input_insulator_&_gate
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Arithmetic, Operation, Simulation, Driver, wire
from catalog import Virtual

isolate = Arithmetic(
    name="Input insulator",
    left=Virtual.each,
    operation=Operation.ADD,
    right=0,
    output=Virtual.each,
)

inputs = Driver("inputs")
inputs.at(0, [Virtual.A.output(4), Virtual.B.output(2)], reset_others=True)
inputs.at(8, [Virtual.A.output(-3), Virtual.B.output(2)], reset_others=True)
inputs.at(16, [], reset_others=True)

wire(inputs, isolate)

scenario = Simulation([isolate, inputs], ticks=26, name="Input insulator")

# Run checks these signal expectations automatically.
scenario.expect(1, isolate, [Virtual.A.output(4)])
scenario.expect(9, isolate, [Virtual.A.output(-3)])
scenario.expect(17, isolate, [Virtual.B.output(0)])
