Signal catalog
==============

Import catalog groups from ``catalog``. Attributes are immutable
``circuit.Signal`` objects and support the methods in :doc:`signals`.

.. code-block:: python

   from catalog import Items, Fluids, Virtual, Qualities

   iron = Items.iron_plate
   water = Fluids.water
   A = Virtual.A
   legendary_iron = iron.with_quality(Qualities.legendary.name)

The catalog comes from Factorio 2.1.23 with the installed official expansions.
It includes hidden/internal prototypes and is not a list of what every game
GUI accepts. Third-party mod prototypes can be addressed with string
factories or ``Signal(name, type)``.

Names use underscores in place of punctuation. Virtual names such as
``signal-A`` become ``Virtual.A``; digits retain ``signal_`` (for example,
``Virtual.signal_0``). Keyword collisions receive a ``signal_`` prefix.

.. toctree::
   :maxdepth: 1
   :glob:

   catalog/*
