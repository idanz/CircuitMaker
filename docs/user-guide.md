# User guide

[Repository](../README.md) · [Simulation reference](simulation.md)

## Make your first circuit

1. Open the workspace and choose a recipe from **Cookbook**.
2. Choose **Python** or **TypeScript** in the filename bar. The example runs automatically.
3. Select **Copy to my files** to make an editable copy.
4. Change the source, then press **Run** or **Ctrl+Enter**.
5. Inspect the result in **Circuit**. Use **Show layout** to see combinators and wires.
6. Copy the blueprint string, import it into Factorio, and connect power and external inputs or outputs.

Python or TypeScript constructs the blueprint. The resulting Factorio circuit contains combinators and wires; it does not run your source code in the game.

## Create or open files

| Action | How |
| --- | --- |
| Start a new circuit | Choose **New** and name the file with a `.py` or `.ts` extension |
| Open a saved circuit | Select it in **My Files** |
| Import source | Use **Upload** to add `.py` or `.ts` files |
| Edit a cookbook recipe | Select **Copy to my files** |
| Switch recipe language | Use Python/TypeScript in the filename bar |

Uploaded files run when you press **Run**. Duplicate filenames receive a numbered suffix to preserve existing files.

The cookbook has 31 recipes in each language, including gates, clocks, counters, pulses, edges, memory, dictionaries, and arrays. Search by recipe name. Language selection carries over when you choose another recipe.

## Write and run code

Use ordinary functions, loops, and typed catalog names to construct `Decider`, `Arithmetic`, and `Constant` combinators. Each file runs independently with the bundled `circuit` and `catalog` modules.

| Python | TypeScript |
| --- | --- |
| `Items.iron_plate` | `Items.ironPlate` |
| `Virtual.A` | `Virtual.A` |
| `Operation.MULTIPLY` | `Operation.MULTIPLY` |

Autocomplete, hover information, signatures, and diagnostics help while editing. **Format** or **Shift+Alt+F** formats the active file; formatting is manual and undoable. Copy a cookbook recipe before formatting or editing it.

**Run** builds the active file. **Stop** terminates execution. Runs stop automatically after 30 seconds. Cookbook examples run automatically when opened or switched between languages; **My Files** run on demand.

### Connect combinators

Use `WireColor.RED` or `WireColor.GREEN` and `Port.INPUT` or `Port.OUTPUT`. The default is a red wire from output to input.

Python accepts keyword arguments:

```python
wire(source, target, color=WireColor.GREEN, target_port=Port.OUTPUT)
```

TypeScript accepts an options object:

```typescript
wire(source, target, { color: WireColor.GREEN, targetPort: Port.OUTPUT });
```

See the runnable [Python](../examples/generator.py) and [TypeScript](../examples/generator.ts) examples for complete circuits.

## Inspect and export

The blueprint selector lists the active file's exports. **All** combines unique supported combinators and their wires, including wires across named groups. Individual combinators, connected components, and named exports are also selectable.

| View | Purpose |
| --- | --- |
| **Circuit** | Inspect conditions, operations, constants, and output settings |
| **Show layout** | Navigate the full circuit and its red/green wires |
| **Simulation** | Inspect captured signal values for a scenario |
| Blueprint string | Copy a blueprint for Factorio's **Import string** |
| JSON | Inspect generated blueprint data |
| Console | Read output, errors, and notices about omitted entities |

Choose an entity with **Inspect**. The circuit view is read-only; change the source and run again to modify it. Use fit and zoom for larger layouts, or **Expand** to fill the window. Press **Escape** to return.

`Blueprint([...])` groups supported combinators and includes their internal wires. Shared entity instances appear only once in **All**.

## Simulate inputs

Define `Driver` schedules and `Simulation` scenarios in the same script as your combinators. **New** provides a small starter scenario; cookbook recipes include scenarios and expected outputs.

Run captures the timeline and checks declared expectations. A failed expectation reports the tick, entity, signal, and expected and actual counts.

In **Simulation**, scrub, step, or play through captured values. This does not rerun the source. Run again after changing the circuit or input schedule.

Drivers supply simulated inputs and are excluded from blueprints. See the [simulation reference](simulation.md) for the API, timing rules, and examples.

## Save, back up, and share

Files save in the current browser. Switching files preserves editor undo history, cursor position, and scroll position during the session.

- Use the source download button to save one file.
- Use **Download files** to export the workspace as a ZIP.
- Use **Upload** to import source in another browser.
- Use **Delete** to remove an editable file. **Undo delete** restores the most recently deleted file, including after a reload.

Cookbook files cannot be deleted.

The URL remembers the selected file and cookbook language. Refresh restores the selection; browser Back/Forward navigates file choices. Cookbook links work in other browsers. **My Files links do not contain source**; share a downloaded source file instead.

## Adjust the workspace

- Drag the divider above the results to resize the editor and output. Arrow keys adjust a focused divider; Shift makes larger steps. Home/End move to the extremes, and Enter or double-click resets it.
- Choose **Theme** at the bottom of the sidebar for **Dark**, **Light**, or **Forest**.

Divider position and theme are remembered in the browser.

## Limits

- Imports between files in **My Files** are not supported.
- `Device` placeholders for pumps, lamps, and belts are excluded from exports and simulation. Add and connect those devices in Factorio as described by the recipe.
- Selector combinators, machines, belts, and power are outside the simulator's scope. See the [simulation reference](simulation.md) for other unsupported cases.
- Exports are limited to 2 MB per artifact and 6 MB in total.
- The catalog comes from Factorio 2.1.23. Automated tests do not establish compatibility with every game version or prove in-game simulation accuracy.
