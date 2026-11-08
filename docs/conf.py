"""Build the API exposed by the browser, directly from its Python sources."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'source-python'), str(ROOT / 'browser-python')]

import circuit_web

# Match the browser worker: graph extensions are installed into `circuit`.
# No scripts run and no simulation bridge is needed to inspect these objects.
circuit_web.install()

project = 'CircuitMaker'
author = 'CircuitMaker contributors'
extensions = ['sphinx.ext.autodoc', 'sphinx.ext.githubpages', 'myst_parser']
source_suffix = {'.rst': 'restructuredtext', '.md': 'markdown'}
exclude_patterns = ['_build', 'requirements.txt']
html_theme = 'furo'
html_title = 'CircuitMaker Python API'
html_baseurl = 'https://idanz.github.io/CircuitMaker/'
html_theme_options = {
    'source_repository': 'https://github.com/idanz/CircuitMaker/',
    'source_branch': 'main',
    'source_directory': 'docs/',
}
autodoc_member_order = 'bysource'
autodoc_typehints = 'signature'
autodoc_class_signature = 'mixed'
autodoc_default_options = {'exclude-members': '__weakref__,__dict__'}
autodoc_preserve_defaults = True


def repository_links(app, docname, source):
    """Keep repository-relative links useful in both GitHub and the built site."""
    source[0] = source[0].replace(
        '(../README.md)', '(https://github.com/idanz/CircuitMaker)'
    ).replace(
        '(../CONTRIBUTING.md)',
        '(https://github.com/idanz/CircuitMaker/blob/main/CONTRIBUTING.md)',
    ).replace(
        '(../examples/',
        '(https://github.com/idanz/CircuitMaker/blob/main/examples/',
    )


def setup(app):
    app.connect('source-read', repository_links)
    app.connect('builder-inited', generate_catalog)


def generate_catalog(app):
    """Give every catalog group a searchable page without copying its inventory."""
    import catalog

    destination = Path(app.srcdir) / 'api' / 'catalog'
    destination.mkdir(parents=True, exist_ok=True)
    for name, group in vars(catalog).items():
        if not isinstance(group, type) or group.__module__ != 'catalog':
            continue
        (destination / f'{name}.rst').write_text(
            f'{name}\n{"=" * len(name)}\n\n'
            f'.. autoclass:: catalog.{name}\n'
            '   :members:\n   :undoc-members:\n',
            encoding='utf-8',
        )
