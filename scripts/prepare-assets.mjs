import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tsCompiler from 'typescript';
import { preparePythonAnalyzer } from './python-analyzer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = path.join(root, 'src/generated');
await mkdir(generated, { recursive: true });
await mkdir(path.join(root, 'public/python'), { recursive: true });
await mkdir(path.join(root, 'public/vendor/pyodide'), { recursive: true });
await mkdir(path.join(root, 'public/vendor/pyright'), { recursive: true });
await mkdir(path.join(root, 'public/vendor/ruff'), { recursive: true });
await mkdir(path.join(root, 'public/types'), { recursive: true });
await mkdir(path.join(root, 'source-python'), { recursive: true });

// These repository-owned Python modules are the web runtime's source of truth.
// Do not read or synchronize files from a neighboring CLI checkout.
for (const name of ['circuit.py', 'catalog.py']) {
  await copyFile(path.join(root, 'source-python', name), path.join(root, 'public/python', name));
}
// Remove an obsolete generated starter left by older local builds.
await rm(path.join(root, 'public/python/supply.py'), { force: true });
for (const name of ['pyodide.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  await copyFile(path.join(root, 'node_modules/pyodide', name), path.join(root, 'public/vendor/pyodide', name));
}
// The maintained Python 3.13 runtime supplies a classic module factory. Wrap it
// as ESM so the opaque-origin sandbox can import its already-fetched bytes.
const pythonModule = await readFile(path.join(root, 'node_modules/pyodide/pyodide.asm.js'), 'utf8');
await writeFile(path.join(root, 'public/vendor/pyodide/pyodide.asm.mjs'), `${pythonModule}\nexport default _createPyodideModule;\n`);
const analyzer = preparePythonAnalyzer(
  await readFile(path.join(root, 'node_modules/monaco-pyright-lsp/dist/worker.js'), 'utf8'),
  await readFile(path.join(root, 'node_modules/monaco-pyright-lsp/assets/typeshed-fallback.zip')),
);
await writeFile(path.join(root, 'public/vendor/pyright/worker.js'), analyzer.worker);
console.log(`Prepared Python analyzer with ${analyzer.files} standard-library declaration files, without the ZIP filesystem.`);
await copyFile(path.join(root, 'node_modules/@astral-sh/ruff-wasm-web/LICENSE'), path.join(root, 'public/vendor/ruff/LICENSE.txt'));

// Derive both the TypeScript catalog and Python analysis declarations from the
// actual generated Python catalog, including its collision/keyword handling.
const catalog = await readFile(path.join(root, 'source-python/catalog.py'), 'utf8');
const groups = {};
let current;
for (const line of catalog.split(/\r?\n/)) {
  const group = /^class (\w+):/.exec(line);
  if (group) current = groups[group[1]] = [];
  const member = /^    (\w+): Final\[Signal\] = Signal\('([^']+)', '([^']+)'\)/.exec(line);
  if (member) current.push({ python: member[1], ts: member[1].replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase()), name: member[2], type: member[3] });
}
const ts = ['// Generated from the existing catalog.py. Do not edit.', "import { Signal } from '../circuit';"];
const pyi = ['from typing import Final', 'from circuit import Signal', ''];
for (const [group, members] of Object.entries(groups)) {
  if (new Set(members.map(m => m.ts)).size !== members.length) throw new Error(`TypeScript catalog collision in ${group}`);
  ts.push(`export const ${group} = Object.freeze({`);
  pyi.push(`class ${group}:`);
  for (const m of members) {
    ts.push(`  ${JSON.stringify(m.ts)}: new Signal(${JSON.stringify(m.name)}, ${JSON.stringify(m.type)}),`);
    pyi.push(`    ${m.python}: Final[Signal]`);
  }
  ts.push('});');
  pyi.push('');
}
await writeFile(path.join(generated, 'catalog.ts'), ts.join('\n'));
await writeFile(path.join(root, 'public/python/catalog.pyi'), pyi.join('\n'));
await writeFile(path.join(generated, 'metadata.json'), JSON.stringify({ factorioVersion: /FACTORIO_VERSION: Final\[str\] = '([^']+)'/.exec(catalog)[1], signals: Object.values(groups).reduce((n, g) => n + g.length, 0) }));

const program = tsCompiler.createProgram([path.join(root, 'src/circuit.ts')], { target: tsCompiler.ScriptTarget.ES2022, module: tsCompiler.ModuleKind.ESNext, moduleResolution: tsCompiler.ModuleResolutionKind.Bundler, declaration: true, emitDeclarationOnly: true, skipLibCheck: true });
let declarations;
program.emit(undefined, (filename, text) => { if (filename.endsWith('circuit.d.ts')) declarations = text; });
if (!declarations) throw new Error('Could not generate CircuitMaker TypeScript declarations');
await writeFile(path.join(root, 'public/types/circuit.d.ts'), `declare module 'circuit' {\n${declarations.replace(/\bdeclare\s+/g, '')}\n}`);
const catalogTypes = ["declare module 'catalog' {", "import { Signal } from 'circuit';"];
for (const [group, members] of Object.entries(groups)) {
  catalogTypes.push(`export const ${group}: {`, ...members.map(m => `readonly ${JSON.stringify(m.ts)}: Signal;`), '};');
}
catalogTypes.push('}');
await writeFile(path.join(root, 'public/types/catalog.d.ts'), catalogTypes.join('\n'));
console.log('Prepared web-owned Python sources, shared catalog, and browser runtimes.');
