"""Thirty tick clock

The constant emits C=1. The shared input bus cycles through 1 to 30; the decider output cycles through 0 to 29. Read the input bus for the 1-based sequence. One full period is 30 ticks, or half a second at 60 updates per second.

Simulation (95 ticks): The existing constant starts the clock. The timeline covers three 30-tick cycles; compare the input bus (1..30) and decider output (0..29).
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Basic_clocks
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Decider, Constant, Simulation, wire
from catalog import Virtual

clock = Decider(
    name="Thirty tick clock",
    when=Virtual.C.less_than(30),
    outputs=[Virtual.C.copy_input()],
)

step = Constant(
    name="Clock increment",
    outputs=[Virtual.C.output(1)],
)

wire(step, clock)
wire(clock, clock)

scenario = Simulation([clock, step], ticks=95, name="Thirty tick clock")

# Run checks these signal expectations automatically.
scenario.expect(29, clock, [Virtual.C.output(29)])
scenario.expect(30, clock, [Virtual.C.output(0)])
scenario.expect(31, clock, [Virtual.C.output(1)])
