import { runSimulations } from './simulation-engine';
import ts from 'typescript';
import * as circuit from './circuit';
import * as catalog from './generated/catalog';
import {start as beginCapture, finish} from './graph-session';
import {collectGraphs} from './collect-graphs';

// This bundle executes only in the opaque-origin, network-denied sandbox.
onmessage = ({ data }) => {
  if (data.type === 'init') { postMessage({ type: 'ready' }); return; }
  if (data.type !== 'run') return;
  const start = performance.now();
  const logs: string[] = [];
  let logBytes = 0;
  const log = (...args: unknown[]) => {
    if (logBytes >= 24_000) return;
    const line = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ').slice(0, 24_000 - logBytes);
    logs.push(line); logBytes += line.length + 1;
  };
  Object.assign(console, { log, warn: log, error: log, info: log, debug: log });
  try {
    beginCapture();
    const code: string = data.code;
    const ast = ts.createSourceFile('user.ts', code, ts.ScriptTarget.ES2022, true);
    const names = ast.statements.flatMap(statement => ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.flatMap(d => ts.isIdentifier(d.name) ? [d.name.text] : []) : []);
    const collect = `\n;Object.assign(exports, {${names.map(name => `${JSON.stringify(name)}: typeof ${name} === 'undefined' ? undefined : ${name}`).join(',')}});`;
    const result = ts.transpileModule(code + collect, {
      fileName: 'user.ts', reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const errors = (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new SyntaxError(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
    const exports: Record<string, unknown> = {};
    const require = (name: string) => {
      if (name === 'circuit') return circuit;
      if (name === 'catalog') return catalog;
      throw new Error(`Module '${name}' is unavailable. This prototype includes circuit and catalog.`);
    };
    new Function('exports', 'require', result.outputText + '\n//# sourceURL=user.js')(exports, require);
    const artifacts = collectGraphs(exports);
    const simulations = runSimulations((circuit as any).simulationPlans());
    if (!artifacts.length && !simulations.length) throw new Error('Create a Decider, Arithmetic or Constant to build a blueprint.');
    if (artifacts.some(a => JSON.stringify(a).length > 2_000_000)) throw new Error('A blueprint exceeds the 2 MB output limit.');
    if (JSON.stringify(artifacts).length > 6_000_000) throw new Error('Combined blueprint output exceeds 6 MB.');
    if (JSON.stringify({artifacts,simulations}).length > 6_000_000) throw new Error('Combined results exceed 6 MB. Reduce simulation ticks.');
    postMessage({ type: 'result', artifacts, simulations, logs, truncated: logBytes >= 24_000, elapsed: performance.now() - start });
  } catch (error) {
    postMessage({ type: 'error', message: error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error), logs, elapsed: performance.now() - start });
  } finally { finish(); }
};
