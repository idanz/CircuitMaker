// Small JSON-RPC transport for the pinned, browser-bundled Pyright worker.
// Keeping the transport here avoids bundling a second copy of that large worker.
export class PythonClient {
  constructor() {
    this.worker = new Worker('/vendor/pyright/worker.js');
    this.pending = new Map(); this.nextID = 1; this.version = 0; this.text = '';
    this.uri = 'file:///user.py';
    this.serverLoaded = new Promise((resolve, reject) => { this.loaded = resolve; this.bootError = reject; });
    this.worker.onmessage = ({ data }) => this.receive(data);
    this.worker.onerror = event => {
      this.bootError(new Error(event.message || 'Python analysis worker failed'));
      for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(new Error('Python analysis worker failed')); }
      this.pending.clear();
    };
    this.connection = { sendNotification: (method, params) => this.notify(method, params) };
  }
  receive(data) {
    if (data.type === 'serverLoaded') { this.loaded(); return; }
    if (data.type === 'serverInitialized') { this.initialized?.(); return; }
    if (data.id !== undefined && !data.method) {
      const pending = this.pending.get(data.id); if (!pending) return;
      this.pending.delete(data.id); clearTimeout(pending.timer);
      if (data.error) pending.reject(new Error(data.error.message)); else pending.resolve(data.result);
    } else if (data.id !== undefined && data.method) {
      this.worker.postMessage({ jsonrpc: '2.0', id: data.id, result: data.method === 'workspace/configuration' ? (data.params?.items ?? []).map(() => null) : null });
    } else if (data.method === 'textDocument/publishDiagnostics' && data.params.uri === this.uri && (data.params.version === undefined || data.params.version === this.version)) {
      this.diagnostics?.(data.params.diagnostics);
    }
  }
  request(method, params) {
    const id = this.nextID++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Python analysis timed out: ${method}`)); }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ jsonrpc: '2.0', id, method, params });
    });
  }
  notify(method, params) { this.worker.postMessage({ jsonrpc: '2.0', method, params }); return Promise.resolve(); }
  async initialize(root, userFiles) {
    await this.serverLoaded;
    await new Promise(resolve => { this.initialized = resolve; this.worker.postMessage({ type: 'initServer', userFiles }); });
    await this.request('initialize', { rootUri: 'file:///', rootPath: '/', processId: null, capabilities: { textDocument: {
      hover: { contentFormat: ['markdown', 'plaintext'] },
      completion: { completionItem: { documentationFormat: ['markdown', 'plaintext'], resolveSupport: { properties: ['documentation', 'detail'] } } },
      signatureHelp: { signatureInformation: { documentationFormat: ['markdown', 'plaintext'] } },
      publishDiagnostics: { versionSupport: true },
    } } });
    this.notify('initialized', {});
    this.notify('textDocument/didOpen', { textDocument: { uri: this.uri, languageId: 'python', version: ++this.version, text: '' } });
  }
  setupDiagnosticsCallback(callback) { this.diagnostics = callback; return Promise.resolve(); }
  updateDocVersion(code) {
    if (code === this.text) return Promise.resolve(this.version);
    this.text = code;
    return this.notify('textDocument/didChange', { textDocument: { uri: this.uri, version: ++this.version }, contentChanges: [{ text: code }] });
  }
  async query(method, code, position) { await this.updateDocVersion(code); return this.request(method, { textDocument: { uri: this.uri }, position }); }
  getCompletion(code, position) { return this.query('textDocument/completion', code, position); }
  resolveCompletion(item) { return this.request('completionItem/resolve', item); }
  getHoverInfo(code, position) { return this.query('textDocument/hover', code, position); }
  getSignatureHelp(code, position) { return this.query('textDocument/signatureHelp', code, position); }
}
