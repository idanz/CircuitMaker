# Python quickstart

Create a `.py` file in CircuitMaker and paste this example:

```python
from circuit import Arithmetic, Blueprint, Constant, Operation, wire
from catalog import Virtual

source = Constant("Input", [Virtual.A.output(5)])
double = Arithmetic("Double A", Virtual.A, Operation.MULTIPLY, 2, Virtual.B)
wire(source, double)
blueprint = Blueprint([source, double], label="Double A")
```

Press **Run**. The constant emits A = 5 and the arithmetic combinator emits
B = 10 after one combinator tick. Inspect the circuit, copy its blueprint
string, and import it into Factorio.

The browser bundles `circuit` and `catalog`; there is currently no published
`pip install circuitmaker` package. These examples target the browser API.
The standalone module in `source-python/` provides the original decider API;
the browser adds arithmetic, constants, wiring, and simulations.

## Conditions and outputs

```python
from circuit import Decider, all_of
from catalog import Items, Virtual

ready = Decider(
    "Ready",
    all_of(Items.iron_plate.at_least(100), Virtual.A.equals(1)),
    [Virtual.B.output(1)],
)
```

Use `.equals()` for circuit equality. Python `==` compares Python objects.
Combine conditions with `all_of()` / `any_of()` or `&` / `|`;
Python `and`, `or`, and chained comparisons do not construct circuits.

Signal selectors such as `Items.iron_plate.red` choose the input network to
read. Choose a physical wire color with `wire(..., color=WireColor.GREEN)`.
Use `.output(count)` for a fixed count and `.copy_input()` to forward an
input count from a decider. Counts must be signed 32-bit integers.

## Simulate the circuit

Add this to the first example:

```python
from circuit import Simulation

Simulation([source, double], ticks=3, name="Doubling").expect(
    1, double, [Virtual.B.output(10)]
)
```

Run checks the expectation and shows the signal timeline. A simulation lists
its participating entities explicitly. Drivers can supply timed inputs;
they are simulation sources and are omitted from exported blueprints.
See the [simulation guide](simulation.md) for timing and network assertions.

The simulator covers the behavior described in that guide. It does not
establish in-game accuracy; check exported circuits in Factorio.
