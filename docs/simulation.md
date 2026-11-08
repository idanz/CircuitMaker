# Script-defined simulations

[User guide](user-guide.md) · [Repository](../README.md)

Choose **New** for a small circuit with a Driver and simulation in either language:
[Python](../examples/simulation.py), [TypeScript](../examples/simulation.ts).
Scenarios belong to the same script as the entities they reference.

```python
from circuit import Decider, Driver, Simulation, wire, WireColor
from catalog import Virtual

counter = Decider("Counter", Virtual.A.greater_than(0), [Virtual.A.copy_input()])
pulses = Driver("Pulse train")
for tick in range(0, 60, 10):
    pulses.pulse(tick, [Virtual.A.output(1)])
wire(counter, counter, color=WireColor.GREEN)
wire(pulses, counter, color=WireColor.GREEN)
Simulation([counter, pulses], ticks=70, name="Six pulses")
```

TypeScript uses `new Driver({name, signals})` and
`new Simulation({entities, ticks, name})`. Use existing typed catalog members, output values,
wire colors and ports. Drivers have output ports only.

## Assertions in scripts

Declare expected signal counts with `.expect(tick, entity, signals)`.
Run checks every expectation automatically against the captured timeline.
Expectations return the scenario, so calls can be chained.

```python
scenario = Simulation([counter, pulses], ticks=70, name="Counter checks")
scenario.expect(0, counter, [Virtual.A.output(0)])
scenario.expect(51, counter, [Virtual.A.output(6), Virtual.B.output(0)])
scenario.expect(0, counter, [Virtual.A.output(1)], color=WireColor.GREEN)
```

TypeScript uses the same `.expect()` signature, with an options object for
network checks:

```typescript
scenario.expect(51, counter, [Virtual.A.output(6), Virtual.B.output(0)]);
scenario.expect(0, counter, [Virtual.A.output(1)], {color: WireColor.GREEN});
```

Only the listed signals are checked; other signals may be present. Use
`.output(0)` to expect absence. Counts must be fixed integers; wildcard signals
and `.copy_input()` / `.copyInput()` cannot express expectations. Quality is
part of signal identity.

Omit `color` to check the entity's own emitted counts. Select `color` to check
the summed network, with `port` defaulting to input. Constants and Drivers
require `port=Port.OUTPUT` (TypeScript: `port: Port.OUTPUT`).

A mismatch fails Run with a message such as:

```text
SimulationAssertionError: Simulation "Counter checks", tick 51, "Counter" (entity 1) output: virtual:signal-A [normal] expected 6, got 5.
```

Call `scenario.run()` to check expectations immediately and obtain a snapshot
for custom logic, loops and ordinary assertions. The existing result readers
remain available:

`value(tick, entity, signal)` reads that entity's own emitted count.
`network_value(tick, entity, signal, color=..., port=Port.INPUT)` reads the
summed network at a port. TypeScript uses
`result.networkValue(tick, entity, signal, {color: WireColor.GREEN, port: Port.INPUT})`.
Use `Port.OUTPUT` to inspect an output network, including other connected
emitters. Constants and Drivers have output ports only.

Absent signals read as zero; quality is part of signal identity. These methods
require a specific signal, a participating entity, and an integer tick from 0
through the scenario's final tick. Wire selectors on a signal do not select a
network here: use the explicit color argument for network reads.

Each `.run()` starts from fresh state and captures wiring and schedules as they
exist at that call. Later changes do not alter its result. The Simulation tab
still captures the final configuration after the script finishes. See the
starter examples for passing assertions in both languages.

## Driver schedules

- `Driver("Source", signals=[Virtual.A.output(5)])` holds its initial signal set.
- `.at(10, [Virtual.B.output(2)])` updates B starting at tick 10; omitted signals
  keep their previous values. Set a signal to zero to clear just that signal.
  `.at(20, [], reset_others=True)` clears all held signals; an empty list alone
  changes nothing. Use `reset_others=True` to replace the entire held set.
  TypeScript uses a third boolean argument: `.at(20, [], true)`.
  Events are sorted by tick, then applied in declaration order at the same tick;
  the last update of each signal wins. A reset also clears earlier updates at that tick.
- `.pulse(12, [Virtual.A.output(1)], duration=2)` adds signals at ticks 12 and 13,
  on top of the held set. Overlapping pulses add together. The default duration
  is one tick; TypeScript passes duration as the third positional argument.

A Simulation lists every participating combinator and Driver explicitly. Only
wires between listed members participate. Multiple named scenarios may reference
the same entities; each starts from a fresh state. All configuration is captured
after the script finishes. Drivers and their wires are omitted from blueprint
exports, including the automatic All export.

## Timeline and timing

Run executes the source, builds the blueprints and calculates each scenario in
the isolated execution worker. Both languages use the same simulation engine.
The Simulation tab provides a scenario selector, tick input, scrubber, step
buttons, playback, network/signal selection and a waveform. Open **Networks**
and **Signals** to check multiple entries, or use All/None. Each selected
network/signal pair gets a trace on a shared scale, including zero values for
signals absent from a network. Wire colors distinguish networks for a single
signal; multiple signals use signal colors and network line styles to distinguish
traces. Straight segments join each tick's sampled value to the next.
Points between integer ticks are visual connections, not additional simulated samples.
The larger graph includes a labeled zero baseline. The compact network
rows below it show signal icons, trace styles and counts at the
selected tick, including selected signals whose count has returned to zero.
Network choices and compact rows identify the named source and destination,
Injected signals versus feedback/output, and wire color/ID. Unwired Driver ports
are hidden; both colors remain available when actually wired to the circuit.
Combinator outputs remain inspectable even without an outgoing wire. The blueprint
diagram is visible by default in Simulation. It flows left to right, with Drivers
and constants before the combinators they feed; feedback loops stay together.
The diagram keeps a horizontal lane on narrow screens, with scrolling for larger
circuits. This schematic arrangement does not change exported blueprint positions.
Nodes show their output signal icons,
and port badges use the same network IDs as the graph and compact rows. Hover or
keyboard-focus an entity, port badge or wire to inspect counts at the selected
tick. Entity tooltips distinguish its own emitted output from summed connected
network values; port and wire tooltips inspect that particular network. Signal
rows show icons and counts without repeating the signal name. Use **Show configuration** for the
existing combinator inspector. Signals use icons in table headers and the signal picker.
Names and quality remain available on hover and to screen readers; non-normal
quality has a visible icon badge. Autocomplete retains code identifiers beside
its icons. The inspector uses the same network IDs. Defaults
compare a Driver with a feedback/output network when they share signals;
otherwise the graph starts on a circuit output and its actual signals.
Switch **Graph / Table** to inspect the same selection as rows of ticks and
columns of signals. Table columns are grouped by named network, with Factorio
icons in signal headers. A network/signal column is omitted if it stays zero
throughout the entire capture; a signal that appears later still has a column
on earlier pages. The table reports how many all-zero columns were hidden.
Within retained columns, zero values remain visible. Tinted cells
mark changes from the preceding tick, including changes to zero.
Hover a changed cell for its previous value and delta. Select a row to inspect that tick, or use the shared
scrubber and playback. Sticky headers and the tick column stay visible while
scrolling. Longer timelines have pages of 100 ticks, including the final frame.
Up to 64 traces
can be displayed together; larger selections show a message to reduce them.
Network rows in the values table also toggle graph inclusion. **Expand**, in the
top simulation controls beside the tick controls, expands the whole simulation
including the graph and diagram. Use **Collapse** or Escape to return.
Editing source marks the captured timeline stale;
Run rebuilds it.

Tick 0 contains initial Constant and Driver signals and zero combinator outputs.
Each update reads all current network values before committing any new outputs.
Arithmetic and Decider outputs arrive one tick later. A scenario with `ticks=70`
captures frames 0 through 70. Condition highlights evaluate the selected tick's
inputs for the following update; the displayed output counts are the outputs
already present at the selected tick. With Each conditions, a highlighted row
means that row passed for at least one signal, not that the entire expression
passed for the same signal.

Red and green networks remain separate; connected emitters add their counts.
Signal identity includes type, name and quality. Counts use signed 32-bit
arithmetic, including overflow. Feedback circuits advance simultaneously,
independently of entity declaration order.

## Current scope

Decider, Arithmetic, Constant and Driver entities are supported. Devices remain
authoring placeholders and cannot be simulated. Selector combinators, power,
machines and physical transport are outside this version.

Anything output works when there is only one output candidate. Multiple candidates
are rejected until Factorio's signal selection ordering is implemented; the
cookbook scenario alternates single channels to avoid this ambiguity.
Arithmetic shift counts are limited to 0–31. Unsupported combinations
raise an error rather than receiving an approximate result. This is an initial
circuit simulator; automated tests cover timing, networks, arithmetic, feedback
and cross-language parity, but it has not yet been checked against recorded
in-game traces.

Each script may define up to eight uniquely named scenarios, each with 1–2000
ticks and 1–256 entities. Signal and serialized timeline limits also bound memory;
large results fail with a message suggesting fewer ticks, entities or signals.
Simulation does not change the separate Python CLI project.
