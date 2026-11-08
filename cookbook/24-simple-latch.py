"""Simple latch from the truth table

External red signals: S is Set and R is Reset. Feedback carries S on green. The next S equals the combined S count only when S>R. With unit inputs, simultaneous Set+Reset cannot set a clear latch, but a held latch can remain on and reach 2. This deliberately preserves the tutorial table behavior; it is not a strict reset-priority Boolean latch.

Simulation (46 ticks): Set at tick 2, reset at 12, try simultaneous Set/Reset on a clear latch at 22, then set at 30 and reset at 38. Read green S between events.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Memory_cells
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Decider, Simulation, Driver, wire, WireColor
from catalog import Virtual

latch = Decider(
    name="Simple tutorial latch",
    when=Virtual.S.greater_than(Virtual.R),
    outputs=[Virtual.S.copy_input()],
)

controls = Driver("controls")
controls.pulse(2, [Virtual.S.output(1)])
controls.pulse(12, [Virtual.R.output(1)], duration=2)
controls.pulse(22, [Virtual.S.output(1), Virtual.R.output(1)])
controls.pulse(30, [Virtual.S.output(1)])
controls.pulse(38, [Virtual.R.output(1)], duration=2)

wire(latch, latch, color=WireColor.GREEN)
wire(controls, latch)

scenario = Simulation([latch, controls], ticks=46, name="Simple latch from the truth table")

# Run checks these signal expectations automatically.
scenario.expect(4, latch, [Virtual.S.output(1)])
scenario.expect(15, latch, [Virtual.S.output(0)])
scenario.expect(24, latch, [Virtual.S.output(0)])
scenario.expect(32, latch, [Virtual.S.output(1)])
scenario.expect(41, latch, [Virtual.S.output(0)])
