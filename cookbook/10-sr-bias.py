"""Biased SR switch

External input: A. Output: S=1 after A reaches 100. Feedback adds 60 to A while active, so the switch stays on until A drops below 40. The feedback path adds two ticks of latency; hold set/reset inputs until it settles. Read S at the decider output.

Simulation (55 ticks): A crosses 100, falls to 60 (held on), falls below 40 (off), then sets and resets again. Read S after the two-stage feedback settles.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Set/Reset_latching_switch
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Decider, Arithmetic, Operation, Simulation, Driver, wire, WireColor
from catalog import Virtual

latch = Decider(
    name="Biased SR switch",
    when=Virtual.A.at_least(100),
    outputs=[Virtual.S.output(1)],
)

bias = Arithmetic(
    name="Hold bias 60",
    left=Virtual.S,
    operation=Operation.MULTIPLY,
    right=60,
    output=Virtual.A,
)

inputs = Driver("inputs")
inputs.at(5, [Virtual.A.output(110)], reset_others=True)
inputs.at(15, [Virtual.A.output(60)], reset_others=True)
inputs.at(25, [Virtual.A.output(39)], reset_others=True)
inputs.at(35, [Virtual.A.output(100)], reset_others=True)
inputs.at(45, [], reset_others=True)

wire(latch, bias)
wire(bias, latch, color=WireColor.GREEN)
wire(inputs, latch)

scenario = Simulation([latch, bias, inputs], ticks=55, name="Biased SR switch")

# Run checks these signal expectations automatically.
scenario.expect(8, latch, [Virtual.S.output(1)])
scenario.expect(18, latch, [Virtual.S.output(1)])
scenario.expect(28, latch, [Virtual.S.output(0)])
scenario.expect(38, latch, [Virtual.S.output(1)])
scenario.expect(48, latch, [Virtual.S.output(0)])
