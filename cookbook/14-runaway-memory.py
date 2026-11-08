"""Constant-driven memory

The constant injects A=1 every tick. Read the red input network to see the source plus the stored value, or the green output for the previous sampled total. Disable the constant to stop counting. Signed counts eventually wrap; a positive-only memory would clear on negative overflow.

Simulation (40 ticks): The existing constant supplies A=1 each tick. Watch the feedback total climb; no external Driver is needed.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Basic_memory
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Decider, Constant, Simulation, wire, WireColor
from catalog import Virtual

memory = Decider(
    name="Constant-driven memory",
    when=Virtual.A.not_equals(0),
    outputs=[Virtual.A.copy_input()],
)

step = Constant(
    name="Increment each tick",
    outputs=[Virtual.A.output(1)],
)

wire(memory, memory, color=WireColor.GREEN)
wire(step, memory)

scenario = Simulation([memory, step], ticks=40, name="Constant-driven memory")

# Run checks these signal expectations automatically.
scenario.expect(10, memory, [Virtual.A.output(10)])
scenario.expect(30, memory, [Virtual.A.output(30)])
