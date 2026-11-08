Signals and expressions
=======================

Import these names from ``circuit``. Catalog attributes are ready-made
signals; string factories also support custom prototype names.

.. autofunction:: circuit.item

.. autofunction:: circuit.fluid

.. autofunction:: circuit.virtual

.. autoclass:: circuit.Signal
   :members:
   :undoc-members:

Compare with ``equals``, ``not_equals``, ``greater_than``, ``less_than``,
``at_least``, or ``at_most``. Each takes an integer or another signal.
``red``, ``green``, and ``both`` select input networks and return a new signal.
``with_quality`` returns a new signal with a quality prototype name.

.. autodata:: circuit.EACH

.. autodata:: circuit.ANYTHING

.. autodata:: circuit.EVERYTHING

Wildcard support depends on the combinator operation. Consult the cookbook
and simulation guide for supported combinations.

.. autoclass:: circuit.Expression
   :members: to_conditions
   :undoc-members:

.. autofunction:: circuit.all_of

.. autofunction:: circuit.any_of

.. autoclass:: circuit.Output
   :members: to_dict
   :undoc-members:

An output count of ``None`` copies the input count. Prefer
``signal.output(count)`` and ``signal.copy_input()`` to constructing outputs
directly. Expressions expand into OR groups of AND conditions, with a limit
of 4096 conditions.

.. autoclass:: circuit.Condition
   :members: to_dict
   :undoc-members:
