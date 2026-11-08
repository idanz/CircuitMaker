# Architecture and hosting

[Repository](../README.md) · [Contributing](../CONTRIBUTING.md)

## Authoring runtimes

`source-python/circuit.py` and `source-python/catalog.py` are the Python sources for this app. Asset preparation copies them into static runtime assets without reading a neighboring repository. Pyodide executes them with the graph and simulation extensions in `browser-python/circuit_web.py`.

`src/circuit.ts` provides the matching TypeScript API. Both languages use the shared simulation engine. Tests compare decoded artifacts against the native Python reference.

`Blueprint.entities` contains declared combinators. `Blueprint.deciders` remains a compatibility view of deciders only; Python also accepts the legacy `deciders=` constructor argument.

## Language services and formatting

The editor pins Monaco 0.52.2 and `monaco-pyright-lsp` 0.1.7, which bundles Pyright 1.1.386. The browser Pyright integration is a prototype dependency; upgrades need compatibility checks.

Python analysis loads source modules alongside their declarations. Pyright and Monaco's TypeScript service supply syntax, import, and type diagnostics.

Python formatting uses `@astral-sh/ruff-wasm-web` 0.17.3 with Python 3.10 syntax, 88-character lines, four-space indentation, and double quotes. A separate worker formats without executing source. Monaco applies edits as one undoable action and discards stale responses if the document changes. TypeScript uses Monaco's formatter.

Ruff lint diagnostics, ESLint, and Prettier are not integrated. Typing, paste, Run, and save do not trigger formatting.

## Signal catalog and graphics

`src/catalog-completion.js` combines the local icon manifest with language-service completions. It recognizes literal catalog names such as `Items` and `Recipes`. Aliased imports retain semantic completion but use ordinary editor glyphs.

The inventory has icon metadata for 1,987 of 2,249 catalog entries. Missing icons use a neutral diamond. Layered icons retain frame, scale, and shift; prototype tinting is not reproduced.

Refresh the manifest and assets from an installed Factorio copy and evaluated data dump:

```sh
python scripts/export-signal-icons.py --data-root "PATH/TO/Factorio/data" --dump "PATH/TO/data-raw-dump.json" --api "PATH/TO/Factorio/doc-html/prototype-api.json"
```

Game graphics belong to Wube Software. Review asset terms separately from project code licensing. Inspector screenshot sources are in [combinator UI references](combinator-ui-references.md).

## Execution isolation

Each runtime uses a classic worker inside an opaque-origin iframe with `sandbox="allow-scripts"`. The iframe's CSP permits its inline bridge and blob code while denying network connections, forms, and other content.

The parent fetches runtime bytes and delivers them over a MessagePort. Pyodide resolves WASM and standard-library requests against supplied in-memory assets. Runtimes receive no application credentials, local filesystem mount, or parent-window reference.

The parent accepts bounded result and error messages and renders output as text. Logs are capped at 24 KB, exports at 2 MB per artifact and 6 MB total. The empty convenience namespace for Python's `js` import is not the security boundary.

Workers permit general computation and provide no dependable per-run memory quota. Runtime modifications may persist until reset. This prototype has not completed a hostile-code security audit; VM tests alone do not establish browser isolation.

Execution bundles are self-contained IIFEs. Keep classic workers for opaque-origin blob URLs: Chromium rejects module-worker startup in this arrangement. Python initializes supplied modules through dynamic imports.

## Static hosting

`pnpm run build` produces `dist/`. `public/_headers` defines deployment policies, and `scripts/serve.mjs` reproduces them for local preview. Preserve these policies on another host; an ordinary static server may omit them.

The sandbox frame also carries a restrictive CSP meta policy. Verify actual response headers, worker startup, WASM loading, network denial, and message bounds in supported browsers when changing hosts or execution code.
