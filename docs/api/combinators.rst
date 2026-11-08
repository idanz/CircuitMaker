Combinators, wiring, and export
===============================

Import these names from ``circuit`` in the browser editor.

.. autoclass:: circuit.Decider
   :members: name, when, outputs
   :undoc-members:

A decider emits all its outputs when its condition passes. Construct
``when`` using signal comparison methods.

.. autoclass:: circuit.Arithmetic
   :members: name, left, operation, right, output
   :undoc-members:

Arithmetic operands accept signals or signed 32-bit integers. ``output``
is a signal, rather than a value returned by ``signal.output()``.

.. autoclass:: circuit.Operation
   :members:
   :undoc-members:

.. autoclass:: circuit.Constant
   :members: name, outputs, enabled
   :undoc-members:

Constants require a nonempty sequence of fixed outputs for ordinary signals.
Pass a list or tuple of values such as ``Virtual.A.output(5)``.

.. autofunction:: circuit.wire

The default connects the source output to the target input with a red wire.
Output-to-output connections join output buses without adding a tick.
Constants and Drivers have output ports only.

.. autoclass:: circuit.WireColor
   :members:
   :undoc-members:

.. autoclass:: circuit.Port
   :members:
   :undoc-members:

.. autoclass:: circuit.Blueprint
   :members: entities, label, deciders, to_dict, to_string, save
   :undoc-members:

Group entities explicitly to create a named export. Internal wires are
included. ``to_dict()`` returns native blueprint JSON; ``to_string()``
returns a Factorio import string. ``save(path)`` writes that string to the
runtime filesystem; use the editor's download controls to save to your
computer. The legacy ``deciders=`` argument is accepted in place of
``entities``.

.. autofunction:: circuit.encode

.. autofunction:: circuit.decode

.. autoclass:: circuit.Device
   :members: name, prototype, when
   :undoc-members:

Device placeholders support ``small-lamp``, ``pump``, and ``transport-belt``.
They and their wires are omitted from exports; simulations accept
combinators and Drivers only.
