import init, { Workspace, PositionEncoding } from '@astral-sh/ruff-wasm-web';
import wasmURL from '@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm?url';

// Formatting parses text; it never imports or executes the user's program.
let workspace;
async function initialize() {
  if (!workspace) {
    workspace = init({ module_or_path: wasmURL }).then(() => new Workspace({
      'target-version': 'py310',
      'line-length': 88,
      'indent-width': 4,
      format: { 'indent-style': 'space', 'quote-style': 'double' },
    }, PositionEncoding.Utf16)).catch(error => { workspace = null; throw error; });
  }
  return workspace;
}

onmessage = async ({ data }) => {
  const id = data.id;
  try {
    if (data.type !== 'format' || typeof data.source !== 'string') throw new Error('Expected Python source to format');
    const formatter = await initialize();
    postMessage({ id, text: formatter.format(data.source) });
  } catch (error) {
    postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
