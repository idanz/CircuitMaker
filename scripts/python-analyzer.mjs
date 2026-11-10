import { unzipSync, strFromU8 } from 'fflate';

// The upstream ZIP filesystem allocates gigabytes during initialization on
// WebKit. Our runtime has no third-party packages, so retain the complete Python
// stdlib declarations and mount their text in ZenFS's ordinary in-memory store.
export function preparePythonAnalyzer(source, archive) {
  const tree = {};
  let files = 0;
  for (const [name, bytes] of Object.entries(unzipSync(archive))) {
    if (name.endsWith('/') || !(name.startsWith('stdlib/') || ['LICENSE', 'commit.txt'].includes(name))) continue;
    const parts = name.split('/');
    let folder = tree;
    for (const part of parts.slice(0, -1)) folder = folder[part] ??= {};
    folder[parts.at(-1)] = strFromU8(bytes); files++;
  }
  if (!tree.stdlib?.['builtins.pyi'] || !tree.stdlib?.['typing.pyi']) throw new Error('Python standard-library declarations are missing');
  const start = source.indexOf('/***/ "./assets/typeshed-fallback.zip":');
  const body = source.indexOf('module.exports = ', start);
  const end = source.indexOf('\n\n/***/ }),', body);
  const setup = 'yield initFs(msg.typeshedFallback);';
  const resizable = 'noResizableBuffers: false,';
  if (start < 0 || body < start || end < body || source.split(setup).length !== 2 || source.split(resizable).length !== 2) throw new Error('Pinned Pyright worker layout changed; review the memory adaptation');
  const worker = (source.slice(0, body) + `module.exports = ${JSON.stringify(tree)};` + source.slice(end))
    .replace(setup, 'yield initFs(false);\n        createUserFiles("/typeshed-fallback", typeshed_fallback_zip_1.default);')
    // ZenFS otherwise reserves a resizable buffer with a 4 GiB maximum for
    // every open file, exhausting browser address space even for tiny stubs.
    .replace(resizable, 'noResizableBuffers: true,')
    // Upstream otherwise leaves a rejected init promise unhandled and the UI
    // waiting indefinitely when worker initialization fails.
    .replace('handleInitServer(msg);', 'handleInitServer(msg).catch(error => postMessage({type: "serverError", message: String(error)}));');
  return { worker, files };
}
