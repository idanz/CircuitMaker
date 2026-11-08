"""Dictionary lookup

Dictionary values are keyed by signal name. The mask contains copper plates=1 and no iron signal. Read the joined final red bus: copper plates=17. Change the one-hot key to select another entry. A mask count other than one scales the value. The vector multiplier has three ticks of latency and the same squared-intermediate range limit.

Simulation (16 ticks): The bundled dictionary and one-hot copper key settle through the multiplier. Read copper plates=17 at the final red output bus.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Multiplier_and_Dictionaries/Arrays
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Arithmetic, Constant, Operation, Simulation, wire, WireColor, Port
from catalog import Items, Virtual

isolate = Arithmetic(
    name="Vector product: isolate A",
    left=Virtual.each.red,
    operation=Operation.ADD,
    right=0,
    output=Virtual.each,
)

sum = Arithmetic(
    name="Add vectors",
    left=Virtual.each,
    operation=Operation.ADD,
    right=0,
    output=Virtual.each,
)

negate = Arithmetic(
    name="Negate B",
    left=Virtual.each.green,
    operation=Operation.MULTIPLY,
    right=-1,
    output=Virtual.each,
)

difference_square = Arithmetic(
    name="Square A minus B",
    left=Virtual.each,
    operation=Operation.POWER,
    right=2,
    output=Virtual.each,
)

sum_square = Arithmetic(
    name="Square A plus B",
    left=Virtual.each,
    operation=Operation.POWER,
    right=2,
    output=Virtual.each,
)

negative_quarter = Arithmetic(
    name="Subtract difference square",
    left=Virtual.each,
    operation=Operation.DIVIDE,
    right=-4,
    output=Virtual.each,
)

positive_quarter = Arithmetic(
    name="Add sum square",
    left=Virtual.each,
    operation=Operation.DIVIDE,
    right=4,
    output=Virtual.each,
)

values = Constant(
    name="Dictionary values",
    outputs=[Items.iron_plate.output(42), Items.copper_plate.output(17)],
)

key = Constant(
    name="One-hot lookup key",
    outputs=[Items.copper_plate.output(1)],
)

wire(isolate, difference_square)
wire(negate, difference_square, color=WireColor.GREEN)
wire(sum, sum_square)
wire(difference_square, negative_quarter)
wire(sum_square, positive_quarter)
wire(negative_quarter, positive_quarter, target_port=Port.OUTPUT)
wire(values, isolate)
wire(values, sum)
wire(key, sum, color=WireColor.GREEN)
wire(key, negate, color=WireColor.GREEN)

scenario = Simulation([isolate, sum, negate, difference_square, sum_square, negative_quarter, positive_quarter, values, key], ticks=16, name="Dictionary lookup")

# Run checks these signal expectations automatically.
scenario.expect(10, positive_quarter, [Items.copper_plate.output(17)], color=WireColor.RED, port=Port.OUTPUT)
scenario.expect(10, positive_quarter, [Items.iron_plate.output(0)], color=WireColor.RED, port=Port.OUTPUT)
