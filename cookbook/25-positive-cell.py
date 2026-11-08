"""Positive value cell

Feed I on the red input bus shared by both deciders. Positive I passes as I; after removal, M carries the remembered value. Read the red bus at the arithmetic input, where the two decider outputs merge. Negative I clears the memory after the pipeline settles. Hold writes for multiple ticks: a one-tick write can alternate between two old values.

Simulation (44 ticks): Hold I=9 for six ticks, release it, then write 4. A held negative I clears memory at tick 30. Read M at the arithmetic input after settling.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Memory_cells
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Decider, Arithmetic, Operation, Simulation, Driver, wire, Port, WireColor
from catalog import Virtual

write_gate = Decider(
    name="Positive value cell",
    when=Virtual.I.greater_than(0),
    outputs=[Virtual.I.copy_input()],
)

hold = Decider(
    name="Read remembered value",
    when=Virtual.I.equals(0),
    outputs=[Virtual.M.copy_input()],
)

rename = Arithmetic(
    name="Store as M",
    left=Virtual.M,
    operation=Operation.ADD,
    right=Virtual.I,
    output=Virtual.M,
)

writes = Driver("writes")
writes.at(2, [Virtual.I.output(9)], reset_others=True)
writes.at(8, [], reset_others=True)
writes.at(16, [Virtual.I.output(4)], reset_others=True)
writes.at(22, [], reset_others=True)
writes.at(30, [Virtual.I.output(-1)], reset_others=True)
writes.at(34, [], reset_others=True)

wire(write_gate, hold, source_port=Port.INPUT)
wire(write_gate, rename)
wire(hold, rename)
wire(rename, hold, color=WireColor.GREEN)
wire(writes, write_gate)

scenario = Simulation([write_gate, hold, rename, writes], ticks=44, name="Positive value cell")

# Run checks these signal expectations automatically.
scenario.expect(14, rename, [Virtual.M.output(9)], color=WireColor.RED, port=Port.INPUT)
scenario.expect(28, rename, [Virtual.M.output(4)], color=WireColor.RED, port=Port.INPUT)
scenario.expect(42, rename, [Virtual.M.output(0)], color=WireColor.RED, port=Port.INPUT)
