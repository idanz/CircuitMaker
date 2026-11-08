Simulation API
==============

Import these names from ``circuit``. See :doc:`../simulation` for event
ordering, supported behavior, and the complete timing model.

.. autoclass:: circuit.Driver
   :members: at, pulse
   :undoc-members:

``signals`` contains fixed outputs for specific signals. ``at`` changes held
values from its tick onward; ``reset_others=True`` replaces the held set.
``pulse`` adds counts temporarily. Both methods return the Driver so calls
can be chained. Event ticks are in the range 0–2000 and pulse durations
are in the range 1–2000.

.. autoclass:: circuit.Simulation
   :members: expect, run
   :undoc-members:

List 1–256 participating combinators and Drivers and choose 1–2000 ticks.
Only wires between listed members participate. Each scenario starts fresh.
``expect`` accepts fixed signal outputs and returns the Simulation. With no
color it checks the entity's emitted count. Set ``color`` and optionally
``port`` to check a summed wire network; the default port is input.

``run()`` returns a snapshot immediately, using the browser's simulation
bridge. It is available inside CircuitMaker, rather than plain CPython.

.. autoclass:: circuit.SimulationResult
   :members: value, network_value
   :undoc-members:

Read ticks from zero through the scenario's configured duration, inclusive.
Absent signals read as zero. ``value`` reads an entity's own emitted count;
``network_value`` reads the sum on the selected wire network.
