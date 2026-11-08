# Contributing

[Repository](README.md) · [Architecture](docs/architecture.md) · [User guide](docs/user-guide.md)

## Development setup

Install Node.js 22.12+, pnpm 10.11.0, and Python 3.10+ for native reference tests.

```sh
git clone https://github.com/idanz/CircuitMaker.git
cd CircuitMaker
pnpm install --frozen-lockfile
pnpm run dev
```

Open http://127.0.0.1:4173. The app owns all its source files and needs no neighboring project or running Factorio installation.

## Build and test

```sh
pnpm run build
pnpm test
```

Build first: runtime tests use the emitted bundles. Run `pnpm run preview` to inspect the production build with deployment headers.

Tests use `python` on Windows and `python3` elsewhere. Override the executable when needed:

```powershell
# PowerShell
$env:CIRCUITMAKER_PYTHON = 'C:\path\to\python.exe'
pnpm test
```

```sh
# POSIX shell
CIRCUITMAKER_PYTHON=python3 pnpm test
```

GitHub CI installs pinned dependencies, builds the app, and runs the same tests on Linux.

## Source map

| Location | Purpose |
| --- | --- |
| `src/circuit.ts` | TypeScript authoring API |
| `source-python/` | Python API and signal catalog |
| `browser-python/circuit_web.py` | Python graph and simulation extensions |
| `src/simulation-engine.js` | Shared simulation engine |
| `src/` | Editors, workers, inspectors, UI, and storage |
| `cookbook/`, `examples/` | Runnable circuits in both languages |
| `scripts/` | Asset preparation, cookbook generation, server, and icon export |
| `tests/` | Reference semantics, runtime parity, editor integration, and UI contracts |

### Generated files

- Edit Python sources in `source-python/` and `browser-python/`.
- `scripts/prepare-assets.mjs` copies runtime assets and derives the TypeScript catalog and Python declarations. Build and dev commands run it automatically.
- Edit recipe generation in `scripts/generate-cookbook.mjs`, then run `node scripts/generate-cookbook.mjs` and review generated changes.
- Keep dependencies and generated build output out of commits. See `.gitignore` for generated locations.

See [architecture](docs/architecture.md) for icon regeneration and dependency constraints.

## Verify behavior changes

`tests/python_reference.py` owns semantic assertions. Add checks there first when changing circuit semantics. Keep both language implementations aligned; `tests/typescript_contract.ts` is a compatibility fixture.

Tests execute emitted runtimes, compare decoded blueprints, run cookbook recipes, and check language services, formatting, storage, and UI contracts. Compare decoded JSON rather than compressed blueprint bytes.

Parity is not independent evidence of Factorio accuracy. For game behavior changes, include the game version, source, blueprint, external connections, and observed signal trace when available.

For UI or execution changes, also check in a browser:

- Create, upload, switch, copy, delete, restore, and download files.
- Run both languages, including errors and **Stop**.
- Check autocomplete, diagnostics, formatting, and undo.
- Inspect combinators, wiring, simulation graphs and tables, and export.
- Refresh and navigate Back/Forward to verify selection and saved files.

Worker VM tests do not verify rendering, CSP enforcement, or isolation. Execution or hosting changes need browser checks of network denial, message bounds, startup, and memory behavior.

## Report a bug

Include a minimal source file, language, browser version, reproduction steps, and expected and actual behavior. For simulation problems, include the tick and signal. For game mismatches, include the game version and blueprint. Remove personal information from shared examples.

## Submit a change

Keep each pull request focused. Describe the problem, resulting behavior, and checks performed. Update the user guide for workflow changes and the simulation reference for API or timing changes.

Preserve local files and recovery behavior when changing storage. Keep formatting explicit and undoable. Analysis and formatting must never execute user-authored circuit code.

The project has no selected code license. Dependencies and game graphics retain their own terms; do not assume the project can grant rights to those assets.
