from dataclasses import dataclass
from enum import Enum
from typing import Any, Literal, Sequence, NoReturn

SignalType = Literal['item', 'fluid', 'virtual', 'entity', 'recipe', 'space-location', 'asteroid-chunk', 'quality']
Network = Literal['red', 'green', 'both']
JSON = dict[str, Any]

@dataclass(frozen=True)
class Signal:
    """An immutable Factorio signal and the input networks it reads."""
    name: str
    type: SignalType = ...
    quality: str | None = ...
    network: Network = ...
    def __init__(self, name: str, type: SignalType = 'item', quality: str | None = None, network: Network = 'both') -> None:
        """Create an immutable signal reference.

        Args:
            name: Factorio signal prototype name; prefer the typed catalog for autocomplete.
            type: Signal prototype category, such as item, fluid, or virtual.
            quality: Quality prototype name; None uses normal quality.
            network: Input networks to read: red, green, or their sum (both).
        """
        ...
    @property
    def red(self) -> Signal:
        """Read this signal from the red input network only."""
        ...
    @property
    def green(self) -> Signal:
        """Read this signal from the green input network only."""
        ...
    @property
    def both(self) -> Signal:
        """Read the sum of this signal on the red and green input networks."""
        ...
    def with_quality(self, quality: str) -> Signal:
        """Return a new signal with the given Factorio quality name.

        Args:
            quality: Quality prototype name, such as 'normal' or 'legendary'.
        """
        ...
    def greater_than(self, other: int | Signal) -> Expression:
        """Build a condition: this signal's count > the given count or signal.

        Args:
            other: Fixed signed 32-bit count or signal to compare against, using its selected input networks.
        """
        ...
    def at_least(self, other: int | Signal) -> Expression:
        """Build a condition: this signal's count >= the given count or signal.

        Args:
            other: Fixed signed 32-bit count or signal to compare against, using its selected input networks.
        """
        ...
    def less_than(self, other: int | Signal) -> Expression:
        """Build a condition: this signal's count < the given count or signal.

        Args:
            other: Fixed signed 32-bit count or signal to compare against, using its selected input networks.
        """
        ...
    def at_most(self, other: int | Signal) -> Expression:
        """Build a condition: this signal's count <= the given count or signal.

        Args:
            other: Fixed signed 32-bit count or signal to compare against, using its selected input networks.
        """
        ...
    def equals(self, other: int | Signal) -> Expression:
        """Build an equality condition. Use this method instead of Python ==.

        Args:
            other: Fixed signed 32-bit count or signal to compare against, using its selected input networks.
        """
        ...
    def not_equals(self, other: int | Signal) -> Expression:
        """Build an inequality condition. Use this method instead of Python !=.

        Args:
            other: Fixed signed 32-bit count or signal to compare against, using its selected input networks.
        """
        ...
    def output(self, count: int = ...) -> Output:
        """Emit a fixed count when the decider condition passes.

        Args:
            count: Fixed signed 32-bit count to emit; defaults to 1.
        """
        ...
    def copy_input(self) -> Output:
        """Copy this signal's count from the selected input networks."""
        ...
    def to_dict(self) -> JSON: ...

class Expression:
    """Use all_of/any_of or &/|. Python and/or do not build circuits."""
    def __bool__(self) -> NoReturn: ...
    def __and__(self, other: Expression) -> Expression: ...
    def __or__(self, other: Expression) -> Expression: ...
    def to_conditions(self) -> list[JSON]: ...

@dataclass(frozen=True)
class Output:
    signal: Signal
    count: int | None = ...
    def __init__(self, signal: Signal, count: int | None = 1) -> None:
        """Describe a combinator output.

        Args:
            signal: Signal to emit; its network selector chooses the input networks for copying.
            count: Fixed signed 32-bit count, or None to copy the selected input count.
        """
        ...
    def to_dict(self) -> JSON: ...

@dataclass(frozen=True)
class Decider:
    """Create a decider combinator with a name, condition, and nonempty output list.

    Combine conditions with all_of()/any_of() or &/|. Use signal.output(count)
    for fixed outputs or signal.copy_input() to copy input counts.
    """
    name: str
    when: Expression
    outputs: Sequence[Output]
    def __init__(self, name: str, when: Expression, outputs: Sequence[Output]) -> None:
        """Create a decider combinator.

        Args:
            name: Descriptive name used in the inspector and blueprint description.
            when: Condition that controls every output. Build with signal.equals(), other comparisons, all_of()/any_of(), or &/|.
            outputs: Nonempty list of fixed signal.output(count) or signal.copy_input() outputs emitted when the condition passes.
        """
        ...
    def to_entity(self, number: int) -> JSON: ...

@dataclass(frozen=True, init=False)
class Blueprint:
    """Group combinators and their internal wires; Device placeholders are omitted."""
    entities: tuple[Decider | Arithmetic | Constant | Device | Driver, ...]
    label: str = ...
    def __init__(self, entities: Sequence[Decider | Arithmetic | Constant | Device | Driver] | None = None, label: str = 'CircuitMaker', *, deciders: Sequence[Decider] | None = None) -> None:
        """Group combinators and their internal wires for export.

        Args:
            entities: Members to export together. Drivers and Device placeholders are omitted from Factorio blueprints.
            label: Name shown for the exported blueprint.
            deciders: Legacy alternative to entities for a group containing only deciders; do not pass both.
        """
        ...
    @property
    def deciders(self) -> tuple[Decider, ...]: ...
    def to_dict(self) -> JSON:
        """Serialize the blueprint and its internal wires to Factorio blueprint JSON."""
        ...
    def to_string(self) -> str:
        """Encode the blueprint as a string that can be imported into Factorio."""
        ...
    def save(self, path: str) -> None:
        """Write the encoded blueprint string to the given file path.

        Args:
            path: Destination filename for the Factorio import string.
        """
        ...


def item(name: str, *, quality: str | None = None) -> Signal:
    """Create an item signal by Factorio prototype name, optionally with a quality.

    Args:
        name: Item prototype name, such as 'iron-plate'.
        quality: Quality prototype name; None uses normal quality.
    """
    ...
def fluid(name: str) -> Signal:
    """Create a fluid signal by Factorio prototype name, such as 'water'.

    Args:
        name: Fluid prototype name, such as 'water'.
    """
    ...
def virtual(name: str) -> Signal:
    """Create a virtual signal from a suffix ('A') or full name ('signal-check').

    Args:
        name: Virtual signal suffix or complete prototype name.
    """
    ...
def all_of(first: Expression, *rest: Expression) -> Expression:
    """Require every condition to pass. Use instead of Python and.

    Args:
        first: First circuit expression to require.
        rest: Additional circuit expressions that must all pass.
    """
    ...
def any_of(first: Expression, *rest: Expression) -> Expression:
    """Require at least one condition to pass. Use instead of Python or.

    Args:
        first: First circuit expression to consider.
        rest: Additional circuit expressions; any passing expression enables the outputs.
    """
    ...
def encode(data: JSON) -> str:
    """Compress blueprint JSON into a Factorio import string starting with '0'.

    Args:
        data: Native Factorio blueprint or blueprint book JSON dictionary.
    """
    ...
def decode(source: str) -> JSON:
    """Read blueprint JSON from a Factorio import string or a JSON string.

    Args:
        source: Factorio import string starting with '0', or a native JSON string.
    """
    ...
EACH: Signal
ANYTHING: Signal
EVERYTHING: Signal

class Operation(str, Enum):
    ADD = '+'
    SUBTRACT = '-'
    MULTIPLY = '*'
    DIVIDE = '/'
    MODULO = '%'
    POWER = '^'
    SHIFT_LEFT = '<<'
    SHIFT_RIGHT = '>>'
    AND = 'AND'
    OR = 'OR'
    XOR = 'XOR'

ArithmeticOperator = Operation | Literal['+', '-', '*', '/', '%', '^', '<<', '>>', 'AND', 'OR', 'XOR']

@dataclass(frozen=True)
class Arithmetic:
    """Apply one arithmetic operation each game tick and emit its result.

    left and right accept fixed integers or signals. Choose an Operation
    (such as Operation.ADD) and an output signal.
    """
    name: str
    left: int | Signal
    operation: ArithmeticOperator
    right: int | Signal
    output: Signal
    def __init__(self, name: str, left: int | Signal, operation: ArithmeticOperator, right: int | Signal, output: Signal) -> None:
        """Create an arithmetic combinator.

        Args:
            name: Descriptive name used in the inspector and blueprint description.
            left: First operand: a fixed signed 32-bit integer or signal read from its selected input networks.
            operation: Arithmetic or bitwise operation, such as Operation.MULTIPLY or '*'.
            right: Second operand: a fixed signed 32-bit integer or signal read from its selected input networks.
            output: Signal that receives the calculated result; use Each for per-signal operations.
        """
        ...
    def to_entity(self, number: int) -> JSON: ...

class Constant:
    """Continuously emit the given fixed outputs while enabled."""
    name: str
    outputs: Sequence[Output]
    def __init__(self, name: str, outputs: Sequence[Output], enabled: bool = True) -> None:
        """Create a constant combinator.

        Args:
            name: Descriptive name used in the inspector and blueprint description.
            outputs: Fixed signal.output(count) values to emit continuously.
            enabled: Whether the constant emits its configured outputs; defaults to True.
        """
        ...
    def to_entity(self, number: int) -> JSON: ...

@dataclass(frozen=True)
class Device:
    """Source-only tutorial placeholder; devices and their wires are not exported."""
    name: str
    prototype: Literal['small-lamp', 'pump', 'transport-belt']
    when: Expression | None = ...
    def __init__(self, name: str, prototype: Literal['small-lamp', 'pump', 'transport-belt'], when: Expression | None = None) -> None:
        """Create a source-only device placeholder.

        Args:
            name: Descriptive name for the placeholder.
            prototype: Factorio device prototype: small-lamp, pump, or transport-belt.
            when: Optional circuit condition for the device. Devices and their wires are omitted from exports.
        """
        ...
    def to_entity(self, number: int) -> JSON: ...

class WireColor(str, Enum):
    RED = 'red'
    GREEN = 'green'
class Port(str, Enum):
    INPUT = 'input'
    OUTPUT = 'output'
WireColorValue = WireColor | Literal['red', 'green']
PortValue = Port | Literal['input', 'output']
def wire(source: Decider | Arithmetic | Constant | Device | Driver, target: Decider | Arithmetic | Constant | Device | Driver, color: WireColorValue = 'red', source_port: PortValue = 'output', target_port: PortValue = 'input') -> None:
    """Connect two entities with a circuit wire.

    Args:
        source: Entity to connect from.
        target: Entity to connect to.
        color: Red or green wire; defaults to red.
        source_port: Source connector; defaults to output.
        target_port: Target connector; defaults to input. Use output to join output buses.
    """
    ...


class Driver:
    """Virtual simulation source. at updates held values; pulse adds values temporarily."""
    name: str
    def __init__(self, name: str, signals: Sequence[Output] = ()) -> None:
        """Create a virtual source used only in simulations.

        Args:
            name: Descriptive name shown in the simulation inspector.
            signals: Initial held signal outputs; defaults to an empty set. Use fixed ordinary signals, not wildcards or copied counts.
        """
        ...
    def at(self, tick: int, signals: Sequence[Output], *, reset_others: bool = False) -> Driver:
        """Update the held signals from this tick onward.

        Args:
            tick: Simulation tick (0..2000). Tick 0 changes the initial frame.
            signals: Fixed outputs to set. Explicit zero clears a signal; omitted signals retain their values.
            reset_others: Clear omitted signals first. Use [] with True to clear all held signals.

        Returns:
            This driver, so calls can be chained. Held signals remain until explicitly changed.
            Active pulses are added on top of the held signals.

        Example:
            inputs.at(0, [Virtual.A.output(4)]).at(20, [], reset_others=True)
        """
        ...
    def pulse(self, tick: int, signals: Sequence[Output], duration: int = 1) -> Driver:
        """Temporarily add signals on top of the held values.

        Args:
            tick: First simulation tick of the pulse (0..2000).
            signals: Fixed signal outputs to add while the pulse is active.
            duration: Number of ticks the pulse lasts (1..2000); defaults to 1.

        Returns:
            This driver, so calls can be chained. Held signals are unchanged after the pulse ends.

        Example:
            inputs.pulse(10, [Virtual.A.output(1)], duration=3)
        """
        ...
    def to_entity(self, number: int) -> JSON: ...

class Simulation:
    """Simulate a wired circuit for 1..2000 ticks and capture its timeline.

    Include all participating combinators and drivers in entities (up to 256).
    Drivers supply virtual inputs and are omitted from exported Factorio blueprints.
    """
    name: str
    ticks: int
    entities: tuple[Decider | Arithmetic | Constant | Driver, ...]
    def __init__(self, entities: Sequence[Decider | Arithmetic | Constant | Driver], ticks: int, name: str = 'Simulation') -> None:
        """Capture a wired circuit's simulation timeline.

        Args:
            entities: All participating combinators and Drivers, up to 256; only wires between listed members participate.
            ticks: Number of game ticks to simulate (1..2000). Results include tick zero and the final tick.
            name: Label used to select this scenario in the Simulation tab.
        """
        ...
    def expect(self, tick: int, entity: Decider | Arithmetic | Constant | Driver, signals: Sequence[Output], *, color: WireColorValue | None = None, port: PortValue | None = None) -> Simulation:
        """Expect signal counts at a tick; checked automatically by Run and .run().

        Args:
            tick: Tick to check, from zero through the final tick.
            entity: Participating entity whose output or network to check.
            signals: Expected fixed outputs, e.g. [Virtual.A.output(3)]. Only listed signals are checked; output(0) expects absence.
            color: Omit for the entity's own output; select red or green for summed network counts.
            port: Network port, input by default. Constants and Drivers require Port.OUTPUT.

        Returns this simulation so expectations can be chained.
        Failures identify the scenario, tick, entity, signal, expected count and actual count.
        """
        ...
    def run(self) -> SimulationResult:
        """Run a fresh snapshot of the circuit as currently configured for script assertions."""
        ...

class SimulationResult:
    """A snapshot returned by Simulation.run(). Absent signals read as zero."""
    def value(self, tick: int, entity: Decider | Arithmetic | Constant | Driver, signal: Signal) -> int:
        """Read this entity's own emitted count at tick, before other emitters are added.

        Args:
            tick: Captured simulation tick from zero through the scenario's final tick.
            entity: Participating combinator or Driver whose own output to read.
            signal: Specific signal and quality to read; absent signals return zero. Wildcards are not supported.
        """
        ...
    def network_value(self, tick: int, entity: Decider | Arithmetic | Constant | Driver, signal: Signal, *, color: WireColorValue, port: PortValue = ...) -> int:
        """Read the summed wire network at a port (input by default).

        Args:
            tick: Captured simulation tick from zero through the scenario's final tick.
            entity: Participating entity at whose port to read the network.
            signal: Specific signal and quality to read; absent signals return zero. Use color to select the network.
            color: WireColor.RED or WireColor.GREEN, or the corresponding string.
            port: Input or output port to inspect; defaults to Port.INPUT. Drivers and constants have output ports only.
        """
        ...
