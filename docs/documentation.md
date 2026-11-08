# Build and publish documentation

The documentation uses Sphinx, MyST Markdown, and the Furo theme. Python
signatures are read from the core sources after installing the browser
extensions, matching the editor's public `circuit` module.

## Build locally

Use Python 3.12 or later, from the repository root:

```sh
python -m pip install -r docs/requirements.txt
python -m sphinx -b html -W --keep-going docs docs/_build/html
python -m http.server 8000 --directory docs/_build/html
```

Open <http://localhost:8000>. Build warnings fail the build. Search and the
Python symbol index are included. Catalog pages are generated from the
actual catalog class members during the Sphinx build.

## GitHub Pages

In repository **Settings → Pages**, choose **GitHub Actions** as the source.
The Documentation workflow checks pull requests and publishes successful
builds on pushes to `main`, or when manually dispatched from `main`.

The intended URL is <https://idanz.github.io/CircuitMaker/>.
Private repository hosting requires a GitHub plan that includes Pages.
Enabling Pages can expose the generated documentation publicly; it does
not change the repository's visibility.

## Edit the reference

Edit `docs/api/` for explanations and public member selections. API
signatures come from `source-python/` and `browser-python/`; add docstrings
there when expanding method documentation. Keep examples aligned with the
browser API. Runtime lifecycle helpers and the standalone CLI are not part
of this browser authoring reference.
