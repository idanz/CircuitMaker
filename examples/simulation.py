"""Run to build the circuit and inspect its Simulation timeline."""
from circuit import Decider, Driver, Simulation, WireColor, wire
from catalog import Virtual

gate = Decider(
    name="Simple gate",
    when=Virtual.A.greater_than(0),
    outputs=[Virtual.B.output(1)],
)

# Hold A from tick 10 through 29. The gate outputs B one tick later.
source = Driver("Input").at(10, [Virtual.A.output(1)]).at(30, [], reset_others=True)
wire(source, gate, color=WireColor.GREEN)
scenario = Simulation([gate, source], ticks=50, name="Simple gate")
# Run checks these expectations and reports expected versus actual counts.
scenario.expect(10, gate, [Virtual.B.output(0)])  # One tick delay.
scenario.expect(11, gate, [Virtual.B.output(1)])  # Gate opens.
scenario.expect(31, gate, [Virtual.B.output(0)])  # Gate closes.
