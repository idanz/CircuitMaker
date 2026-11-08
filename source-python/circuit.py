"""Typed Python builders for Factorio 2.0.36+ decider blueprints."""

from __future__ import annotations

import argparse
import base64
import copy
from dataclasses import dataclass, replace
import json
from pathlib import Path
import runpy
import sys
from typing import Any, Literal, NoReturn, Sequence
import zlib

SignalType = Literal[
    "item",
    "fluid",
    "virtual",
    "entity",
    "recipe",
    "space-location",
    "asteroid-chunk",
    "quality",
]
Network = Literal["red", "green", "both"]
Comparator = Literal[">", "<", "=", "≥", "≤", "≠"]
JSON = dict[str, Any]
VERSION = (2 << 48) | (36 << 16)
MAX_CONDITIONS = 4096


def _int32(value: int) -> None:
    if type(value) is not int or not -(2**31) <= value < 2**31:
        raise ValueError("Expected a signed 32-bit integer")


@dataclass(frozen=True)
class Signal:
    """A signal and the input networks it reads. Use item(), fluid() or virtual()."""

    name: str
    type: SignalType = "item"
    quality: str | None = None
    network: Network = "both"

    def __post_init__(self) -> None:
        if not isinstance(self.name, str) or not self.name:
            raise ValueError("Signal name must be a nonempty string")
        if self.type not in (
            "item",
            "fluid",
            "virtual",
            "entity",
            "recipe",
            "space-location",
            "asteroid-chunk",
            "quality",
        ):
            raise ValueError("Unknown signal type")
        if self.network not in ("red", "green", "both"):
            raise ValueError("Unknown input network")
        if self.quality is not None and (
            not isinstance(self.quality, str) or not self.quality
        ):
            raise ValueError("Quality must be a nonempty string")

    @property
    def red(self) -> Signal:
        """Read only the red input network."""
        return replace(self, network="red")

    @property
    def green(self) -> Signal:
        """Read only the green input network."""
        return replace(self, network="green")

    @property
    def both(self) -> Signal:
        return replace(self, network="both")

    def with_quality(self, quality: str) -> Signal:
        return replace(self, quality=quality)

    def to_dict(self) -> JSON:
        result: JSON = {"type": self.type, "name": self.name}
        if self.quality is not None:
            result["quality"] = self.quality
        return result

    def _compare(self, comparator: Comparator, other: int | Signal) -> Expression:
        if not isinstance(other, Signal):
            _int32(other)
        return Expression(((Condition(self, comparator, other),),))

    def greater_than(self, other: int | Signal) -> Expression:
        return self._compare(">", other)

    def at_least(self, other: int | Signal) -> Expression:
        return self._compare("≥", other)

    def less_than(self, other: int | Signal) -> Expression:
        return self._compare("<", other)

    def at_most(self, other: int | Signal) -> Expression:
        return self._compare("≤", other)

    def equals(self, other: int | Signal) -> Expression:
        return self._compare("=", other)

    def not_equals(self, other: int | Signal) -> Expression:
        return self._compare("≠", other)

    def output(self, count: int = 1) -> Output:
        """Emit a fixed count when the decider's condition passes."""
        return Output(self, count)

    def copy_input(self) -> Output:
        """Copy this signal's count from its selected input networks."""
        return Output(self, None)


def item(name: str, *, quality: str | None = None) -> Signal:
    return Signal(name, "item", quality)


def fluid(name: str) -> Signal:
    return Signal(name, "fluid")


def virtual(name: str) -> Signal:
    """Accept a suffix such as 'A' or a full name such as 'signal-check'."""
    return Signal(name if name.startswith("signal-") else "signal-" + name, "virtual")


EACH = virtual("each")
ANYTHING = virtual("anything")
EVERYTHING = virtual("everything")


def _networks(signal: Signal) -> JSON:
    return {"red": signal.network != "green", "green": signal.network != "red"}


@dataclass(frozen=True)
class Condition:
    left: Signal
    comparator: Comparator
    right: int | Signal

    def to_dict(self) -> JSON:
        result: JSON = {
            "first_signal": self.left.to_dict(),
            "comparator": self.comparator,
            "first_signal_networks": _networks(self.left),
        }
        if isinstance(self.right, Signal):
            result.update(
                second_signal=self.right.to_dict(),
                second_signal_networks=_networks(self.right),
            )
        else:
            result["constant"] = self.right
        return result


@dataclass(frozen=True)
class Expression:
    """OR groups of AND conditions. Combine with all_of()/any_of() or ``&`` / ``|``."""

    groups: tuple[tuple[Condition, ...], ...]

    def __post_init__(self) -> None:
        if not self.groups or any(not group for group in self.groups):
            raise ValueError("An expression needs at least one condition per group")
        if sum(map(len, self.groups)) > MAX_CONDITIONS:
            raise ValueError(f"Expression expands beyond {MAX_CONDITIONS} conditions")

    def __bool__(self) -> NoReturn:
        raise TypeError(
            "Use all_of()/any_of() or & / |, not Python and/or or chained comparisons"
        )

    def __and__(self, other: Expression) -> Expression:
        if not isinstance(other, Expression):
            raise TypeError("AND requires an Expression")
        size = sum(map(len, self.groups)) * len(other.groups) + sum(
            map(len, other.groups)
        ) * len(self.groups)
        if size > MAX_CONDITIONS:
            raise ValueError(f"Expression expands beyond {MAX_CONDITIONS} conditions")
        return Expression(tuple(a + b for a in self.groups for b in other.groups))

    def __or__(self, other: Expression) -> Expression:
        if not isinstance(other, Expression):
            raise TypeError("OR requires an Expression")
        return Expression(self.groups + other.groups)

    def to_conditions(self) -> list[JSON]:
        result = []
        for group in self.groups:
            for index, condition in enumerate(group):
                value = condition.to_dict()
                if result:
                    value["compare_type"] = "and" if index else "or"
                result.append(value)
        return result


def all_of(first: Expression, *rest: Expression) -> Expression:
    """Require every expression to pass."""
    if not isinstance(first, Expression):
        raise TypeError("all_of requires Expressions")
    for expression in rest:
        first = first & expression
    return first


def any_of(first: Expression, *rest: Expression) -> Expression:
    """Require at least one expression to pass."""
    if not isinstance(first, Expression):
        raise TypeError("any_of requires Expressions")
    for expression in rest:
        first = first | expression
    return first


@dataclass(frozen=True)
class Output:
    signal: Signal
    count: int | None = 1

    def __post_init__(self) -> None:
        if not isinstance(self.signal, Signal):
            raise TypeError("Output requires a Signal")
        if self.count is not None:
            _int32(self.count)

    def to_dict(self) -> JSON:
        result: JSON = {
            "signal": self.signal.to_dict(),
            "networks": _networks(self.signal),
            "copy_count_from_input": self.count is None,
        }
        if self.count is not None:
            result["constant"] = self.count
        return result


@dataclass(frozen=True)
class Decider:
    name: str
    when: Expression
    outputs: Sequence[Output]

    def __post_init__(self) -> None:
        if not isinstance(self.name, str) or not self.name:
            raise ValueError("Decider needs a name")
        if not isinstance(self.when, Expression):
            raise TypeError(
                "when must be an Expression; use signal.equals() instead of =="
            )
        if not self.outputs or any(not isinstance(o, Output) for o in self.outputs):
            raise TypeError("outputs must contain at least one Output")
        object.__setattr__(self, "outputs", tuple(self.outputs))

    def to_entity(self, number: int) -> JSON:
        return {
            "entity_number": number,
            "name": "decider-combinator",
            "position": {"x": (number - 1) * 3 + 0.5, "y": 0},
            "control_behavior": {
                "decider_conditions": {
                    "conditions": self.when.to_conditions(),
                    "outputs": [o.to_dict() for o in self.outputs],
                }
            },
        }


@dataclass(frozen=True)
class Blueprint:
    deciders: Sequence[Decider]
    label: str = "CircuitMaker"

    def __post_init__(self) -> None:
        if not self.deciders or any(not isinstance(d, Decider) for d in self.deciders):
            raise TypeError("Blueprint requires at least one Decider")
        object.__setattr__(self, "deciders", tuple(self.deciders))

    def to_dict(self) -> JSON:
        return {
            "blueprint": {
                "item": "blueprint",
                "label": self.label,
                "version": VERSION,
                "description": "\n".join(
                    f"{i}: {d.name}" for i, d in enumerate(self.deciders, 1)
                ),
                "entities": [d.to_entity(i) for i, d in enumerate(self.deciders, 1)],
            }
        }

    def to_string(self) -> str:
        return encode(self.to_dict())

    def save(self, path: str | Path) -> None:
        Path(path).write_text(self.to_string() + "\n", encoding="utf-8")


def encode(data: JSON) -> str:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return "0" + base64.b64encode(zlib.compress(raw, 9)).decode("ascii")


def decode(source: str) -> JSON:
    source = source.strip()
    if source.startswith("{"):
        return json.loads(source)
    if not source.startswith("0"):
        raise ValueError("Expected blueprint JSON or a string starting with 0")
    return json.loads(zlib.decompress(base64.b64decode(source[1:], validate=True)))


def from_json(data: JSON) -> JSON:
    if "blueprint" in data or "blueprint_book" in data:
        return data
    if not data.get("conditions") or not data.get("outputs"):
        raise ValueError("Expected a blueprint or conditions and outputs arrays")
    result = Blueprint(
        [
            Decider(
                "JSON decider", virtual("A").greater_than(0), [virtual("A").output()]
            )
        ],
        label=data.get("label", "JSON decider"),
    ).to_dict()
    settings = copy.deepcopy(
        {"conditions": data["conditions"], "outputs": data["outputs"]}
    )
    for condition in settings["conditions"]:
        op = condition.get("comparator", "<")
        condition["comparator"] = {">=": "≥", "<=": "≤", "!=": "≠", "==": "="}.get(
            op, op
        )
    result["blueprint"]["entities"][0]["control_behavior"]["decider_conditions"] = (
        settings
    )
    return result


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["build", "json", "encode", "decode"])
    parser.add_argument(
        "input",
        help="Python source for build/json, JSON or blueprint for encode/decode",
    )
    parser.add_argument("output", nargs="?")
    args = parser.parse_args(argv)
    try:
        if args.command in ("build", "json"):
            # Python authoring files are normal executable programs.
            path = Path(args.input).resolve()
            sys.path.insert(0, str(path.parent))
            try:
                namespace = runpy.run_path(str(path))
            finally:
                sys.path.pop(0)
            blueprint = namespace.get("blueprint")
            if not isinstance(blueprint, Blueprint):
                raise TypeError(
                    "Python authoring file must define blueprint = Blueprint(...)"
                )
            data = blueprint.to_dict()
        else:
            source = (
                sys.stdin.read()
                if args.input == "-"
                else Path(args.input).read_text(encoding="utf-8-sig")
            )
            data = (
                from_json(json.loads(source))
                if args.command == "encode"
                else decode(source)
            )
        result = (
            encode(data)
            if args.command in ("build", "encode")
            else json.dumps(data, ensure_ascii=False, indent=2)
        )
        if args.output:
            Path(args.output).write_text(result + "\n", encoding="utf-8")
        else:
            if hasattr(sys.stdout, "reconfigure"):
                sys.stdout.reconfigure(encoding="utf-8")
            print(result)
        return 0
    except (ValueError, TypeError, OSError, zlib.error, RecursionError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.modules["circuit"] = sys.modules[__name__]
    sys.exit(main())
