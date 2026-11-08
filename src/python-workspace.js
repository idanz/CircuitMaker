// The analyzer sees the same implementations as the execution runtime, with
// stubs for concise API declarations. A stub alone cannot prove a module exists.
export const PYTHON_MODULE_FILES = ['circuit.py', 'catalog.py', 'circuit.pyi', 'catalog.pyi'];
export const PYTHON_SETTINGS = {
  python: {
    analysis: {
      typeshedPaths: ['/typeshed-fallback'],
      stubPath: '/typings',
      extraPaths: ['/typings'],
      typeCheckingMode: 'basic',
      diagnosticMode: 'openFilesOnly',
    },
    pythonVersion: '3.10',
    pythonPlatform: 'All',
  },
};

export async function loadPythonWorkspace(readSource = async name => {
  const response = await fetch(`/python/${name}`);
  if (!response.ok) throw new Error(`Could not load Python analysis module ${name}`);
  return response.text();
}) {
  return Object.fromEntries(await Promise.all(PYTHON_MODULE_FILES.map(async name => [name, await readSource(name)])));
}
