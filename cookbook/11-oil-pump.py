"""Light oil pump hysteresis

Connect tank light-oil counts to the latch input with red wire. The pump enables at 20000 and holds while the tank is at least 5000; it disables below 5000 after feedback settles. The inclusive comparator means exactly 5000 remains enabled. Attach the pump to pipes in-game; this blueprint supplies its circuit control.

Device declarations here are source-only placeholders. Devices and their wires are omitted from every export; add and connect them manually in Factorio.

Simulation (65 ticks): A Driver stands in for the tank: oil rises to 22000, drops through 10000 and 5000, then below 5000. Read S; the pump placeholder itself is not simulated.
Run builds a blueprint and calculates the Simulation timeline. Each combinator takes one tick. Drivers are simulation-only and are omitted from blueprints.
Source topic: https://wiki.factorio.com/Tutorial:Combinator_tutorial#Set/Reset_latching_switch
Original CircuitMaker implementation and explanation; parameters are editable in a copy."""
from circuit import Decider, Arithmetic, Device, Operation, Simulation, Driver, wire, WireColor
from catalog import Fluids, Virtual

latch = Decider(
    name="Light oil pump hysteresis",
    when=Fluids.light_oil.at_least(20000),
    outputs=[Virtual.S.output(1)],
)

bias = Arithmetic(
    name="Light oil hold bias",
    left=Virtual.S,
    operation=Operation.MULTIPLY,
    right=15000,
    output=Fluids.light_oil,
)

pump = Device(
    name="Controlled pump",
    prototype="pump",
    when=Virtual.S.greater_than(0),
)

tank = Driver("tank")
tank.at(5, [Fluids.light_oil.output(22000)], reset_others=True)
tank.at(15, [Fluids.light_oil.output(10000)], reset_others=True)
tank.at(25, [Fluids.light_oil.output(5000)], reset_others=True)
tank.at(35, [Fluids.light_oil.output(4999)], reset_others=True)
tank.at(45, [Fluids.light_oil.output(25000)], reset_others=True)
tank.at(55, [], reset_others=True)

wire(latch, bias)
wire(bias, latch, color=WireColor.GREEN)
wire(latch, pump)
wire(tank, latch)

scenario = Simulation([latch, bias, tank], ticks=65, name="Light oil pump hysteresis")

# Run checks these signal expectations automatically.
scenario.expect(8, latch, [Virtual.S.output(1)])
scenario.expect(18, latch, [Virtual.S.output(1)])
scenario.expect(28, latch, [Virtual.S.output(1)])
scenario.expect(38, latch, [Virtual.S.output(0)])
scenario.expect(48, latch, [Virtual.S.output(1)])
scenario.expect(58, latch, [Virtual.S.output(0)])
