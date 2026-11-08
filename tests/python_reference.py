"""Python owns the circuit semantics; TypeScript is checked against this contract."""
import sys
from pathlib import Path

if "__file__" in globals():
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "source-python"))

from circuit import Blueprint, Decider, EACH, all_of, any_of, decode, fluid, item, virtual

A, B, C, D = [virtual(name) for name in "ABCD"]
nested = all_of(any_of(A.greater_than(0), B.greater_than(0)),
                any_of(C.greater_than(0), D.greater_than(0)))
iron = item("iron-plate")
legendary = iron.with_quality("legendary")
contract = Blueprint([
    Decider("Nested conditions", nested, [A.output(1)]),
    Decider("Wire and quality", legendary.red.less_than(iron.green),
            [legendary.red.copy_input(), fluid("water").green.output(-1)]),
    Decider("Integer bounds", all_of(A.at_least(-(2**31)), B.at_most(2**31 - 1)),
            [C.output(2**31 - 1), D.output(-(2**31))]),
    Decider("Each input", EACH.red.at_least(1), [EACH.red.copy_input()]),
], label="Shared circuit contract")

if __name__ == "__main__":
    import itertools
    import unittest
    from dataclasses import FrozenInstanceError

    class PythonReference(unittest.TestCase):
        def test_nested_truth_table(self):
            conditions = nested.to_conditions()
            self.assertEqual(len(conditions), 8)
            for bits in itertools.product((False, True), repeat=4):
                values = dict(zip("ABCD", bits))
                groups = []
                for condition in conditions:
                    if condition.get("compare_type") != "and":
                        groups.append([])
                    groups[-1].append(values[condition["first_signal"]["name"][-1]])
                self.assertEqual(any(map(all, groups)), (bits[0] or bits[1]) and (bits[2] or bits[3]))

        def test_wire_quality_and_copy(self):
            value = contract.to_dict()["blueprint"]["entities"][1]["control_behavior"]["decider_conditions"]
            self.assertEqual(value["conditions"][0]["first_signal"]["quality"], "legendary")
            self.assertEqual(value["conditions"][0]["second_signal_networks"], {"red": False, "green": True})
            self.assertTrue(value["outputs"][0]["copy_count_from_input"])

        def test_constants_are_signed_int32(self):
            for value in [True, 2**31, -(2**31) - 1, 1.5, "1"]:
                with self.subTest(value=value), self.assertRaises(ValueError):
                    A.output(value)
            self.assertEqual(A.output(-(2**31)).count, -(2**31))

        def test_immutable_selectors(self):
            self.assertEqual(iron.network, "both")
            self.assertIsNone(iron.quality)
            with self.assertRaises(FrozenInstanceError):
                iron.name = "changed"

        def test_python_boolean_misuse(self):
            with self.assertRaises(TypeError):
                bool(nested)
            with self.assertRaises(TypeError):
                Decider("wrong", True, [A.output()])

        def test_expansion_limit(self):
            expression = A.equals(1)
            with self.assertRaisesRegex(ValueError, "4096"):
                for _ in range(13):
                    expression = all_of(expression, any_of(A.equals(1), B.equals(1)))

        def test_codec_and_entity_positions(self):
            self.assertEqual(decode(contract.to_string()), contract.to_dict())
            entities = contract.to_dict()["blueprint"]["entities"]
            self.assertEqual([e["entity_number"] for e in entities], [1, 2, 3, 4])
            self.assertEqual([e["position"]["x"] for e in entities], [0.5, 3.5, 6.5, 9.5])

    unittest.main()
