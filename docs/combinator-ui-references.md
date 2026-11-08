# In-game combinator UI references

Reviewed 2026-11-05. Use these primary sources when changing an inspector;
do not use old 1.1 or modded screenshots as references for the current UI.

## Arithmetic (implemented)

- [Official wiki screenshot and history](https://wiki.factorio.com/File:Arithmetic_combinator_gui.png), current image dated 2025-12-18.
- [Full screenshot](https://wiki.factorio.com/images/Arithmetic_combinator_gui.png).
- [Official behavior documentation](https://wiki.factorio.com/Arithmetic_combinator).
- [Developer UI overview](https://factorio.com/blog/post/fff-384) and
  [earlier 2.0 development screenshot](https://cdn.factorio.com/assets/blog-sync/fff-384-arithmetic-combinator.png).

The current screenshot has two columns: Input (operand, operator, operand) and
Output (signal), with input/output signal trays directly below. The operation is
not a decider-style condition group. Red/green network selectors sit alongside
signal operands. The preview retains configured choices, without inventing live counts.

## Constant (implemented)

- [Official wiki screenshot and history](https://wiki.factorio.com/File:Constant_combinator_gui.png), current image documented as 2.0.60.
- [Full screenshot](https://wiki.factorio.com/images/Constant_combinator_gui.png).
- [Official behavior documentation](https://wiki.factorio.com/Constant_combinator).
- [Developer example](https://factorio.com/blog/post/fff-392) and
  [full development screenshot](https://cdn.factorio.com/assets/blog-sync/fff-392-constant-combinator-configuration.png).

This is a narrow window with one connection strip, an entity preview, Output
Off/On control, and section frames. Each section has an enabled checkbox,
optional logistic group name (otherwise "[No group assigned]"), signal slots
with numeric counts, and an Add section row. There is no input port or input
signal tray. Section enabled state and overall output enabled state are distinct.

## Selector (reference only; no authoring API yet)

- [Official developer screenshot](https://cdn.factorio.com/assets/blog-sync/fff-384-selector-combinator.png).
- [Developer explanation](https://factorio.com/blog/post/fff-384).
- [Current official mode documentation](https://wiki.factorio.com/Selector_combinator).

The developer screenshot is a 2023 development reference, not a complete current
mode inventory. It shows a vertical list of radio-button modes, with parameters
below the selected mode (index, sort direction, interval, or quality/signal
selection). Consult the current wiki and target game version for available modes.
Do not show a selector as supported until both language APIs and blueprint
serialization implement it and agree in the comparison tests.

## Preview constraints

Inspectors are read-only views of generated blueprint JSON. Editing controls
are disabled. Configured counts and network choices may be shown; power state,
live network IDs, live signal values, and condition truth must not be fabricated.
Game graphics remain attributed to Wube Software as described in the README.
