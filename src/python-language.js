import { PythonClient } from './python-client';
import { loadPythonWorkspace, PYTHON_SETTINGS } from './python-workspace';

const range = r => ({ startLineNumber: r.start.line + 1, startColumn: r.start.character + 1, endLineNumber: r.end.line + 1, endColumn: r.end.character + 1 });
const documentation = doc => doc == null ? undefined : typeof doc === 'string' || doc.kind === 'plaintext' ? (doc.value ?? doc) : { value: doc.value, isTrusted: false };

export async function initializePython(monaco, editor) {
  const client = new PythonClient();
  await client.initialize('/', await loadPythonWorkspace());
  await client.connection.sendNotification('workspace/didChangeConfiguration', {
    settings: PYTHON_SETTINGS,
  });
  const complete = async (code, position) => {
    const result = await client.getCompletion(code, { line: position.lineNumber - 1, character: position.column - 1 });
    return Array.isArray(result) ? result : result?.items ?? [];
  };
  const kinds = [0, monaco.languages.CompletionItemKind.Text, monaco.languages.CompletionItemKind.Method, monaco.languages.CompletionItemKind.Function, monaco.languages.CompletionItemKind.Constructor, monaco.languages.CompletionItemKind.Field, monaco.languages.CompletionItemKind.Variable, monaco.languages.CompletionItemKind.Class, monaco.languages.CompletionItemKind.Interface, monaco.languages.CompletionItemKind.Module, monaco.languages.CompletionItemKind.Property, monaco.languages.CompletionItemKind.Unit, monaco.languages.CompletionItemKind.Value, monaco.languages.CompletionItemKind.Enum, monaco.languages.CompletionItemKind.Keyword, monaco.languages.CompletionItemKind.Snippet, monaco.languages.CompletionItemKind.Color, monaco.languages.CompletionItemKind.File, monaco.languages.CompletionItemKind.Reference];
  const completionItems = new WeakMap();
  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.'],
    async provideCompletionItems(m, position) {
      const word = m.getWordUntilPosition(position);
      const fallback = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const items = await complete(m.getValue(), position);
      return { suggestions: items.map(item => {
        const suggestion = { label: item.label, kind: kinds[item.kind] ?? monaco.languages.CompletionItemKind.Text, detail: item.detail, sortText: item.sortText, insertText: item.textEdit?.newText ?? item.insertText ?? item.label, range: item.textEdit?.range ? range(item.textEdit.range) : item.textEdit?.insert ? { insert: range(item.textEdit.insert), replace: range(item.textEdit.replace) } : fallback, documentation: documentation(item.documentation) };
        completionItems.set(suggestion, item);
        return suggestion;
      }) };
    },
    async resolveCompletionItem(item, token) {
      const original = completionItems.get(item);
      if (!original || token.isCancellationRequested) return item;
      const resolved = await client.resolveCompletion(original);
      if (!resolved || token.isCancellationRequested) return item;
      return { ...item, detail: resolved.detail ?? item.detail, documentation: documentation(resolved.documentation) ?? item.documentation };
    },
  });
  monaco.languages.registerHoverProvider('python', {
    async provideHover(m, p) {
      const info = await client.getHoverInfo(m.getValue(), { line: p.lineNumber - 1, character: p.column - 1 });
      if (!info?.contents) return null;
      return { contents: [{ value: info.contents.value ?? String(info.contents), isTrusted: false }], ...(info.range ? { range: range(info.range) } : {}) };
    },
  });
  monaco.languages.registerSignatureHelpProvider('python', {
    signatureHelpTriggerCharacters: ['(', ','],
    async provideSignatureHelp(m, p) {
      const info = await client.getSignatureHelp(m.getValue(), { line: p.lineNumber - 1, character: p.column - 1 });
      if (!info) return null;
      return { value: { ...info, signatures: info.signatures.map(s => ({ ...s, documentation: documentation(s.documentation), parameters: s.parameters?.map(p => ({ ...p, documentation: documentation(p.documentation) })) })) }, dispose() {} };
    },
  });
  await client.setupDiagnosticsCallback(diagnostics => {
    const model = editor.getModel();
    if (!model || model.getValue() !== client.text) return;
    monaco.editor.setModelMarkers(model, 'pyright', diagnostics.map(d => ({ ...range(d.range), message: d.message, severity: d.severity === 1 ? monaco.MarkerSeverity.Error : d.severity === 2 ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info })));
  });
  let debounce;
  editor.onDidChangeModel(() => {
    clearTimeout(debounce);
    const model = editor.getModel();
    if (model) { monaco.editor.setModelMarkers(model, 'pyright', []); client.updateDocVersion(model.getValue()); }
  });
  editor.onDidChangeModelContent(() => {
    clearTimeout(debounce); debounce = setTimeout(() => client.updateDocVersion(editor.getValue()), 250);
  });
  await client.updateDocVersion(editor.getValue());
  return { client, complete };
}
