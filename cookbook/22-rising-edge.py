"""Rising edge detector

Feed A into the source. Its green output bus subtracts the previous sample; a filter emits P=1 only for positive deltas. Falling edges disappear. Source insulation plus the filter add two ticks before the event output. Larger positive changes also produce a unit event.

Simulation (55 ticks): A changes 0 to 1 at tick 5, falls at 15, rises to 4 at 25, drops to 1 at 35, and clears at 45. Compare signed deltas with rising-only events.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Edge_detectors
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Arithmetic, Decider, Operation, Simulation, Driver, wire, WireColor, Port
from catalog import Virtual

source = Arithmetic(
    name="Rising edge detector",
    left=Virtual.A,
    operation=Operation.ADD,
    right=0,
    output=Virtual.A,
)

delay = Arithmetic(
    name="Delayed negation",
    left=Virtual.A,
    operation=Operation.MULTIPLY,
    right=-1,
    output=Virtual.A,
)

rise = Decider(
    name="Keep positive deltas",
    when=Virtual.A.greater_than(0),
    outputs=[Virtual.P.output(1)],
)

inputs = Driver("inputs")
inputs.at(5, [Virtual.A.output(1)], reset_others=True)
inputs.at(15, [], reset_others=True)
inputs.at(25, [Virtual.A.output(4)], reset_others=True)
inputs.at(35, [Virtual.A.output(1)], reset_others=True)
inputs.at(45, [], reset_others=True)

wire(source, delay)
wire(source, delay, color=WireColor.GREEN, target_port=Port.OUTPUT)
wire(delay, rise, color=WireColor.GREEN)
wire(inputs, source)

scenario = Simulation([source, delay, rise, inputs], ticks=55, name="Rising edge detector")

# Run checks these signal expectations automatically.
scenario.expect(7, rise, [Virtual.P.output(1)])
scenario.expect(17, rise, [Virtual.P.output(0)])
scenario.expect(27, rise, [Virtual.P.output(1)])
scenario.expect(37, rise, [Virtual.P.output(0)])
