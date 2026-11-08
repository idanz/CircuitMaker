# CircuitMaker

Write Factorio combinator circuits in **Python or TypeScript**, inspect their wiring and signals, and export blueprint strings from your browser.

## Features

- Code editor with typed signal catalogs, autocomplete, diagnostics, and formatting.
- Arithmetic, decider, and constant combinators with red and green wiring.
- 31 cookbook examples in both languages.
- Script-defined simulations with signal timelines and expectations.
- Blueprint string and JSON export.

## Run locally

Requires Node.js 22.12+ and pnpm 10.11.0.

```sh
git clone https://github.com/idanz/CircuitMaker.git
cd CircuitMaker
pnpm install --frozen-lockfile
pnpm run build
pnpm run preview
```

Open **http://127.0.0.1:4173**, choose a cookbook example, and press **Copy to my files** to edit it.

## Documentation

The [Python API documentation](https://idanz.github.io/CircuitMaker/) includes
a quickstart, searchable reference, and signal catalog. See
[building and publishing the docs](docs/documentation.md) for local setup.

| Guide | Covers |
| --- | --- |
| [User guide](docs/user-guide.md) | Create circuits, use the editor, simulate, export, and back up files |
| [Simulation reference](docs/simulation.md) | Drivers, expectations, timing, and simulation limits |
| [Contributing](CONTRIBUTING.md) | Development setup, tests, source ownership, and pull requests |
| [Architecture](docs/architecture.md) | Runtimes, language services, assets, and hosting policies |

## Status and limits

CircuitMaker is a preview. Automated tests cover runtime behavior and Python/TypeScript parity; they do not establish in-game accuracy or complete browser security verification. The catalog comes from Factorio 2.1.23.

Files save in the current browser. Download your source files to back them up or share them. See the [user guide](docs/user-guide.md#limits) for supported behavior and current limits.

## Credits and licensing

An unofficial Factorio fan tool. Factorio and its game graphics belong to Wube Software. Cookbook topics reference the [Factorio combinator tutorial](https://wiki.factorio.com/Tutorial:Combinator_tutorial).

No license has been selected for the project code. Dependencies and bundled game assets retain their respective terms.
