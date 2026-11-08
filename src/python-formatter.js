import RuffWorker from './ruff-worker.js?worker';

class RuffFormatter {
  constructor() { this.worker = null; this.pending = new Map(); this.nextID = 1; }
  format(source) {
    if (!this.worker) {
      this.worker = new RuffWorker();
      this.worker.onmessage = ({ data }) => {
        const pending = this.pending.get(data.id); if (!pending) return;
        this.pending.delete(data.id); clearTimeout(pending.timer);
        if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data.text);
      };
      this.worker.onerror = () => this.reset('Python formatter could not start. Try Format again.');
    }
    const id = this.nextID++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.reset('Python formatting timed out. Try Format again.'), 45_000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, type: 'format', source });
    });
  }
  reset(message = 'Python formatter stopped') {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(message)); }
    this.pending.clear(); this.worker?.terminate(); this.worker = null;
  }
}

export function registerPythonFormatter(monaco, onStatus, onBusy) {
  const formatter = new RuffFormatter();
  let active = 0;
  const registration = monaco.languages.registerDocumentFormattingEditProvider('python', {
    async provideDocumentFormattingEdits(model, _options, cancellation) {
      const version = model.getVersionId();
      const source = model.getValue();
      const range = model.getFullModelRange();
      onBusy(++active > 0);
      try {
        const text = await formatter.format(source);
        if (model.isDisposed() || cancellation.isCancellationRequested) return [];
        if (version !== model.getVersionId()) { onStatus('Code changed while formatting. Press Format again.'); return []; }
        if (text === source) { onStatus('Python is already formatted.'); return []; }
        onStatus('Python formatted with Ruff. Ctrl+Z to undo.');
        // Monaco applies formatter edits as an undoable action, just like TS.
        return [{ range, text }];
      } catch (error) {
        onStatus(`Python format failed: ${error.message}. Your code was kept.`);
        return [];
      } finally { onBusy(--active > 0); }
    },
  });
  return { dispose() { registration.dispose(); formatter.reset(); } };
}
