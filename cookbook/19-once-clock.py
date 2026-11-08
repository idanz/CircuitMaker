"""One-time clock

This recreates the tutorial feedback topology: the tick decider emits T=1 while T<Z; the storage decider holds T while R=0. Z is 180. Reset is initially disabled: enable its constant in-game briefly, then disable it. Observe both networks when stepping; the tick and storage stages introduce a pipeline delay.

Simulation (430 ticks): The clock reaches its target and holds. A reset Driver injects R for four ticks starting at 230, then the clock runs to the target again.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Basic_clocks
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Decider, Constant, Simulation, Driver, wire, WireColor
from catalog import Virtual

tick = Decider(
    name="One-time clock",
    when=Virtual.T.less_than(Virtual.Z),
    outputs=[Virtual.T.output(1)],
)

limit = Constant(
    name="Target Z=180",
    outputs=[Virtual.Z.output(180)],
)

reset = Constant(
    name="Enable to reset",
    outputs=[Virtual.R.output(1)],
    enabled=False,
)

hold = Decider(
    name="Clock storage",
    when=Virtual.R.equals(0),
    outputs=[Virtual.T.copy_input()],
)

reset_pulse = Driver("reset pulse")
reset_pulse.pulse(230, [Virtual.R.output(1)], duration=4)

wire(limit, tick, color=WireColor.GREEN)
wire(reset, hold, color=WireColor.GREEN)
wire(tick, hold)
wire(hold, tick)
wire(hold, hold, color=WireColor.GREEN)
wire(reset_pulse, hold, color=WireColor.GREEN)

scenario = Simulation([tick, limit, reset, hold, reset_pulse], ticks=430, name="One-time clock")

# Run checks these signal expectations automatically.
scenario.expect(220, hold, [Virtual.T.output(181)])
scenario.expect(240, hold, [Virtual.T.output(6)])
scenario.expect(430, hold, [Virtual.T.output(181)])
