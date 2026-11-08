from catalog import Items, Virtual
from circuit import Blueprint, Decider, Driver, Signal, Simulation, WireColor, wire


def make_rule(signal: Signal, minimum: int) -> Decider:
    return Decider(
        name=f"Check {signal.name}",
        when=signal.green.at_least(minimum),
        outputs=[Virtual.A.output(1)],
    )


settings = [
    (Items.iron_plate, 100),
    (Items.copper_plate, 200),
    (Items.steel_plate, 50),
]

blueprint = Blueprint(
    [make_rule(signal, minimum) for signal, minimum in settings],
    label="Supply generator",
)

print(f"Generated {len(settings)} deciders.")

# Below threshold at tick 5, sufficient supply at 15, empty again at 25.
source = Driver("Supply levels")
source.at(5, [signal.output(minimum - 1) for signal, minimum in settings])
source.at(15, [signal.output(minimum) for signal, minimum in settings])
source.at(25, [], reset_others=True)
for rule in blueprint.deciders:
    wire(source, rule, color=WireColor.GREEN)
scenario = Simulation([*blueprint.deciders, source], ticks=35, name="Supply thresholds")
# Every rule is checked when Run calculates the simulation.
for rule in blueprint.deciders:
    scenario.expect(6, rule, [Virtual.A.output(0)])   # Below threshold.
    scenario.expect(15, rule, [Virtual.A.output(0)])  # One tick delay.
    scenario.expect(16, rule, [Virtual.A.output(1)])  # Threshold reached.
    scenario.expect(26, rule, [Virtual.A.output(0)])  # Supply cleared.
