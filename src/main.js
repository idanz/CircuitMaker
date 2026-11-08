import simulationPython from '../examples/simulation.py?raw';
import simulationTypeScript from '../examples/simulation.ts?raw';
import { createSimulationView } from './simulation-view';
import { initializePaneSplitters } from './pane-splitter';
import { createCircuitPreview } from './circuit-preview';
import './style.css';
import { initializeThemes } from './themes';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { Runner } from './runner';
import { initializePython } from './python-language';
import { zipSync, strToU8 } from 'fflate';
import cookbookManifest from '../cookbook/manifest.json';
import { loadWorkspace, WORKSPACE_KEY, lastDeletedFile, deleteWorkspaceFile, restoreWorkspaceFile } from './workspace-storage';
import { readSourceFile, availableUploadName } from './source-upload';
import { fileSelectionHash, fileFromHash } from './file-navigation';
import { attachCatalogCompletion } from './catalog-completion';
import { registerPythonFormatter } from './python-formatter';
import generatorPython from '../examples/generator.py?raw';
import generatorTypeScript from '../examples/generator.ts?raw';

self.MonacoEnvironment = { getWorker(_, label) { return label === 'typescript' || label === 'javascript' ? new TypeScriptWorker() : new EditorWorker(); } };
const $ = selector => document.querySelector(selector);
const languages = ['python', 'typescript'];
const EXECUTION_TIMEOUT_MS = 30_000;
const lanes = {};
const examples = { generator: { python: generatorPython, typescript: generatorTypeScript } };
let noticeTimer;
const notify = message => { $('#notice').textContent = message; $('#notice').classList.add('visible'); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('#notice').classList.remove('visible'), 6500); };
const duration = ms => ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
const actionButton = (language, action) => $(`[data-lang="${language}"][data-action="${action}"]`);
function draft(language, example) { try { return localStorage.getItem(`circuitmaker-lab:${example}:${language}`); } catch { return null; } }
function saveDraft(language) {
  if (!activeFile || activeFile.language !== language || activeFile.readonly) return;
  activeFile.code = lanes[language].editor.getValue();
  persistWorkspace();
}
let activeFile;
let renamingFile = null;
let workspaceFiles = [];
let cookbookFiles = [];
let cookbookLanguage = 'python';
const fileStates = new WeakMap();
const folderStates = new Map();
let canSaveWorkspace = true;
function persistWorkspace() {
  if (!canSaveWorkspace) return;
  try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspaceFiles)); }
  catch {
    canSaveWorkspace = false;
    if (activeFile && !activeFile.readonly) $(`#${activeFile.language}-pane .file-hint`).textContent = 'Unsaved · Download to keep';
    notify('Could not save locally. Download your source to keep a copy.');
  }
}
function showFile(file, { replaceUrl = false } = {}) {
  if (!file) return;
  const hash = fileSelectionHash(file);
  if (location.hash !== hash) history[replaceUrl ? 'replaceState' : 'pushState'](null, '', hash);
  if (activeFile === file) return;
  if (activeFile) {
    const previous = lanes[activeFile.language], saved = fileStates.get(activeFile);
    Object.assign(saved, { viewState: previous.editor.saveViewState(), result: previous.result, error: previous.error, builtCode: previous.builtCode, view: previous.view, selected: $(`#${activeFile.language}-artifact`).value });
  }
  for (const language of languages) {
    const lane = lanes[language];
    if (lane.busy) lane.runner.stop('File changed. Build cancelled.');
    lane.simulationView?.pause();
    $(`#${language}-pane`).hidden = language !== file.language;
  }
  activeFile = file;
  if (file.readonly) cookbookLanguage = file.language;
  const lane = lanes[file.language];
  const filebar = $(`#${file.language}-pane .filebar`);
  const hint = filebar.querySelector('.file-hint');
  filebar.insertBefore($('#cookbook-language-picker'), hint);
  filebar.insertBefore($('#copy-example'), hint);
  filebar.append($('#rename-file'), $('#delete-file'), $('#download-workspace'));
  $('#rename-file').hidden = !!file.readonly;
  $('#delete-file').hidden = !!file.readonly;
  let state = fileStates.get(file);
  if (!state) {
    state = { model: monaco.editor.createModel(file.code, file.language, monaco.Uri.parse(`file:///${file.readonly ? 'cookbook' : 'workspace'}/${encodeURIComponent(file.name)}`)), view: 'circuit', result: null, error: null, builtCode: null };
    fileStates.set(file, state);
  }
  lane.switching = true; lane.editor.setModel(state.model); lane.switching = false;
  if (state.viewState) lane.editor.restoreViewState(state.viewState);
  lane.editor.updateOptions({ readOnly: !!file.readonly });
  Object.assign(lane, { result: state.result, error: state.error, builtCode: state.builtCode, view: state.view });
  $(`#${file.language}-filename`).textContent = file.readonly ? file.id : file.name;
  $(`#${file.language}-pane .file-hint`).textContent = file.readonly ? 'Read only · Copy to edit' : canSaveWorkspace ? 'Saved locally' : 'Unsaved · Download to keep';
  $(`#${file.language}-artifact`).replaceChildren(Object.assign(document.createElement('option'), { textContent: 'No build yet' }));
  $(`#${file.language}-artifact`).disabled = true;
  fillArtifacts(file.language, state.selected);
  actionButton(file.language, 'format').disabled = !!file.readonly;
  renderOutput(file.language); renderFiles();
  $('#copy-example').hidden = !file.readonly;
  requestAnimationFrame(alignSidebarBrand);
  $('#cookbook-language-picker').hidden = !file.readonly;
  for (const button of document.querySelectorAll('[data-cookbook-language]')) {
    const selected = button.dataset.cookbookLanguage === cookbookLanguage;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  if (file.language === 'typescript' && lane.intelligenceConfigured && !lane.intelligenceReady) {
    warmTypeScript().catch(error => {
      $('#typescript-diagnostics').textContent = 'IntelliSense unavailable';
      notify(`TypeScript IntelliSense: ${error?.message ?? String(error)}`);
    });
  }
  if (file.readonly) {
    // Let a cancelled build finish cleaning up before starting this example.
    Promise.resolve(lane.runPromise).then(() => {
      if (activeFile === file) run(file.language);
    });
  }
}
function renderFiles() {
  try { $('#restore-file').hidden = !lastDeletedFile(localStorage); } catch { $('#restore-file').hidden = true; }
  const list = $('#workspace-files'); list.replaceChildren();
  for (const file of workspaceFiles) {
    const button = document.createElement('button'); button.textContent = file.name;
    button.className = file === activeFile ? 'workspace-file selected' : 'workspace-file';
    button.onclick = () => showFile(file); list.append(button);
  }
  const cookbook = $('#cookbook-files'); cookbook.replaceChildren();
  const needle = $('#cookbook-search').value.trim().toLowerCase();
  const groups = new Map();
  const titles = {Virtual_signals:'Signals & wildcards', 'Input_insulator_&_gate':'Insulators & gates', 'Set/Reset_latching_switch':'Set / reset switches', Basic_memory:'Feedback memory', Basic_clocks:'Clocks', Pulse_generators:'Pulse generators', Edge_detectors:'Edge detectors', Counter:'Counters', Memory_cells:'Memory cells', 'Multiplier_and_Dictionaries/Arrays':'Products & lookups'};
  for (const recipe of cookbookManifest.filter(r => `${r.id} ${r.title}`.toLowerCase().includes(needle))) {
    const file = cookbookFiles.find(f => f.id === recipe.id && f.language === cookbookLanguage);
    const selected = activeFile?.readonly && activeFile.id === recipe.id;
    let group = groups.get(file.section);
    if (!group) {
      group = document.createElement('details'); group.open = !!needle || (folderStates.get(file.section) ?? file.section === 'Virtual_signals');
      const summary = document.createElement('summary'); summary.textContent = titles[file.section] ?? file.section; group.append(summary);
      group.addEventListener('toggle', () => { if (group.isConnected) folderStates.set(file.section, group.open); });
      groups.set(file.section, group); cookbook.append(group);
    }
    if (selected) group.open = true;
    const button = document.createElement('button'); button.textContent = recipe.id;
    button.title = file.title;
    button.className = selected ? 'workspace-file selected' : 'workspace-file';
    if (selected) button.setAttribute('aria-current', 'true');
    button.onclick = () => showFile(file); group.append(button);
  }
  if (!groups.size) cookbook.textContent = 'No matching examples.';
}
function createFile() {
  openFileDialog();
}
function openFileDialog(file = null) {
  renamingFile = file;
  const language = file?.language ?? activeFile?.language ?? 'python';
  const extension = language === 'python' ? '.py' : '.ts';
  $('#new-file-language').value = language;
  $('#new-file-language').disabled = !!file;
  $('#new-file-title').textContent = file ? 'Rename file' : 'New circuit file';
  $('#save-file').textContent = file ? 'Save name' : 'Create file';
  $('#new-file-extension').textContent = extension;
  const input = $('#new-file-name');
  input.value = (file?.name ?? availableUploadName(`my_circuit${extension}`, workspaceFiles)).slice(0, -3);
  input.setCustomValidity('');
  $('#new-file-dialog').showModal();
  input.focus(); input.select();
}
function submitFileDialog(event) {
  event.preventDefault();
  const input = $('#new-file-name');
  const extension = $('#new-file-language').value === 'python' ? '.py' : '.ts';
  const stem = input.value.trim().replace(/\.(py|ts)$/i, '');
  const name = stem + extension;
  const error = !/^[\w .-]+$/.test(stem) ? 'Use letters, numbers, spaces, dots, hyphens or underscores.'
    : workspaceFiles.some(file => file !== renamingFile && file.name.toLowerCase() === name.toLowerCase()) ? 'That filename already exists.' : '';
  input.setCustomValidity(error);
  if (error) { input.reportValidity(); return; }
  if (renamingFile) {
    const file = renamingFile;
    if (file.name !== name) {
      const state = fileStates.get(file), lane = lanes[file.language];
      const viewState = lane.editor.saveViewState();
      const model = monaco.editor.createModel(state.model.getValue(), file.language, monaco.Uri.parse(`file:///workspace/${encodeURIComponent(name)}`));
      const previous = state.model;
      state.model = model;
      lane.switching = true; lane.editor.setModel(model); lane.switching = false;
      if (viewState) lane.editor.restoreViewState(viewState);
      previous.dispose();
      file.name = name; file.code = model.getValue();
      persistWorkspace();
      history.replaceState(null, '', fileSelectionHash(file));
      $(`#${file.language}-filename`).textContent = name;
      renderFiles();
    }
  } else if (!addFile(name, extension === '.py' ? simulationPython : simulationTypeScript)) return;
  $('#new-file-dialog').close();
}
function addFile(name, code) {
  if (!/^[\w .-]+\.(py|ts)$/.test(name)) { notify('Use a filename ending in .py or .ts.'); return false; }
  if (workspaceFiles.some(f => f.name.toLowerCase() === name.toLowerCase())) { notify('That filename already exists.'); return false; }
  const language = name.endsWith('.py') ? 'python' : 'typescript';
  code ??= language === 'python' ? 'from circuit import Decider\nfrom catalog import Virtual\n\nDecider(\n    name="My circuit",\n    when=Virtual.A.greater_than(0),\n    outputs=[Virtual.B.output()],\n)\n' : 'import { Decider } from "circuit";\nimport { Virtual } from "catalog";\n\nnew Decider({\n  name: "My circuit",\n  when: Virtual.A.greaterThan(0),\n  outputs: [Virtual.B.output()],\n});\n';
  const file = { name, code, language };
  workspaceFiles.push(file); persistWorkspace(); showFile(file); return true;
}

const editorTheme = initializeThemes(monaco);

for (const language of languages) {
  $(`#${language}-editor`).replaceChildren();
  const editor = monaco.editor.create($(`#${language}-editor`), {
    value: '', language, theme: editorTheme, fontFamily: 'Consolas, "Cascadia Code", monospace', fontSize: 12,
    wordWrap: 'on',
    lineHeight: 19, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false,
    padding: { top: 16, bottom: 14 }, tabSize: language === 'python' ? 4 : 2, lineNumbersMinChars: 3,
    renderLineHighlight: 'line', overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
    formatOnType: false, formatOnPaste: false,
    wordBasedSuggestions: 'off', fixedOverflowWidgets: true, contextmenu: false,
    scrollbar: { verticalScrollbarSize: 7, horizontalScrollbarSize: 7 },
    suggest: { showWords: false },
  });
  const lane = lanes[language] = { editor, view: 'circuit', result: null, builtCode: null, busy: false, intelligenceReady: false };
  lane.circuitPreview = createCircuitPreview($(`#${language}-circuit`));
  lane.simulationView = createSimulationView($(`#${language}-simulation`));
  const start = performance.now();
  lane.runner = new Runner(language, state => {
    lane.state = state;
    const label = $(`#${language}-state`);
    label.textContent = { starting: 'Starting runtime…', ready: '● Ready', running: '● Building…', error: 'Setup failed', stopped: 'Runtime reset' }[state];
    label.className = `engine-state ${state}`;
    actionButton(language, 'run').disabled = lane.busy || state === 'starting';
  });
  lane.runtimePromise = lane.runner.initialize().then(() => { $(`#${language}-startup`).textContent = duration(performance.now() - start); }).catch(error => { lane.error = error.message; renderOutput(language); });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run(language));
  editor.onDidChangeModelContent(() => { if (!lane.switching) saveDraft(language); renderOutput(language); });
  $(`#${language}-artifact`).addEventListener('change', () => renderOutput(language));
}

const pythonFormatter = registerPythonFormatter(monaco, notify, busy => {
  const button = actionButton('python', 'format');
  button.disabled = busy || (activeFile?.language === 'python' && !!activeFile.readonly); button.textContent = busy ? 'Formatting…' : 'Format';
});

async function formatEditor(language) {
  if (activeFile?.readonly) return;
  const lane = lanes[language];
  const before = lane.editor.getValue();
  try {
    await lane.editor.getAction('editor.action.formatDocument').run();
    if (language === 'typescript') notify(before === lane.editor.getValue() ? 'TypeScript is already formatted.' : 'TypeScript formatted. Ctrl+Z to undo.');
  } catch (error) { notify(`Format failed: ${error.message}`); }
}

async function initializeTypeScript() {
  const defaults = monaco.languages.typescript.typescriptDefaults;
  defaults.setCompilerOptions({ target: monaco.languages.typescript.ScriptTarget.ES2022, module: monaco.languages.typescript.ModuleKind.CommonJS, moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs, strict: true, allowNonTsExtensions: true, lib: ['es2022'], noEmit: false });
  defaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
  const texts = await Promise.all(['/types/circuit.d.ts', '/types/catalog.d.ts'].map(async url => { const r = await fetch(url); if (!r.ok) throw new Error(`Could not load ${url}`); return r.text(); }));
  texts.forEach((text, i) => defaults.addExtraLib(text, `file:///types/${i === 0 ? 'circuit' : 'catalog'}.d.ts`));
  defaults.addExtraLib('declare const console: { log(...values: unknown[]): void; warn(...values: unknown[]): void; error(...values: unknown[]): void; info(...values: unknown[]): void; };', 'file:///types/console.d.ts');
  lanes.typescript.intelligenceConfigured = true;
  // Monaco activates rich language features when a TypeScript editor is shown.
  if (activeFile?.language === 'typescript') await warmTypeScript();
}

async function warmTypeScript() {
  const lane = lanes.typescript;
  if (lane.warming) return lane.warming;
  lane.warming = (async () => {
  const start = performance.now();
  // The browser may finish downloading tsMode before Monaco's activation
  // callback has registered TypeScript. Wait only for that startup race.
  let getWorker;
  for (let attempt = 0; attempt < 5; attempt++) {
    try { getWorker = await monaco.languages.typescript.getTypeScriptWorker(); break; }
    catch (error) {
      if (String(error) !== 'TypeScript not registered!' || attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  const model = lane.editor.getModel();
  if (!model) return; // The selected file may have been deleted during startup.
  await getWorker(model.uri);
  lanes.typescript.getWorker = getWorker;
  lanes.typescript.intelligenceReady = true;
  $(`#typescript-intelligence`).textContent = duration(performance.now() - start);
  updateDiagnostics();
  })();
  try { await lane.warming; } finally { lane.warming = null; }
}

function updateDiagnostics() {
  for (const language of languages) {
    const lane = lanes[language];
    if (!lane.intelligenceReady) continue;
    const model = lane.editor.getModel();
    if (!model) continue;
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const errors = markers.filter(m => m.severity === monaco.MarkerSeverity.Error).length;
    const warnings = markers.filter(m => m.severity === monaco.MarkerSeverity.Warning).length;
    const label = $(`#${language}-diagnostics`);
    label.textContent = errors ? `${errors} error${errors === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : '✓ No errors';
    label.title = markers.map(m => `Line ${m.startLineNumber}: ${m.message}`).join('\n');
    label.classList.toggle('has-errors', errors > 0);
  }
}
monaco.editor.onDidChangeMarkers(updateDiagnostics);

function run(language) {
  const lane = lanes[language];
  if (lane.busy) return lane.runPromise;
  lane.runPromise = buildFile(language);
  return lane.runPromise;
}

async function buildFile(language) {
  const lane = lanes[language];
  const fileAtStart = activeFile;
  if (lane.busy) return;
  lane.busy = true; lane.error = null;
  const code = lane.editor.getValue();
  actionButton(language, 'run').disabled = true;
  actionButton(language, 'stop').disabled = false;
  try {
    const result = await lane.runner.run(code, EXECUTION_TIMEOUT_MS);
    if (activeFile !== fileAtStart) return;
    lane.result = result; lane.builtCode = code;
    lane.error = result.type === 'error' ? result.message : null;
    if (lane.error) lane.view = 'console';
    else if (result.simulations?.length) lane.view = 'simulation';
    else if (lane.view === 'simulation') lane.view = 'circuit';
    if (typeof result.elapsed === 'number') $(`#${language}-build`).textContent = duration(result.elapsed);
    fillArtifacts(language);
  } catch (error) {
    if (activeFile !== fileAtStart) return;
    lane.error = error.message; lane.result = null; lane.view = 'console'; lane.builtCode = null;
  } finally {
    lane.busy = false; actionButton(language, 'run').disabled = false; actionButton(language, 'stop').disabled = true;
    if (activeFile === fileAtStart) renderOutput(language);
  }
}
function fillArtifacts(language, selected) {
  const select = $(`#${language}-artifact`); select.replaceChildren();
  for (const artifact of lanes[language].result?.artifacts ?? []) select.append(Object.assign(document.createElement('option'), { value: artifact.name, textContent: artifact.label ?? artifact.name }));
  if (!select.options.length) select.append(Object.assign(document.createElement('option'), {textContent:'No build yet'}));
  select.disabled = !lanes[language].result?.artifacts?.length;
  if (selected && [...select.options].some(o=>o.value===selected)) select.value=selected;
}

function selectedArtifact(language) {
  const artifacts = lanes[language].result?.artifacts;
  return artifacts?.find(a => a.name === $(`#${language}-artifact`).value) ?? artifacts?.[0];
}
function renderOutput(language) {
  const lane = lanes[language], artifact = selectedArtifact(language);
  const pre = $(`#${language}-content`);
  const isCircuit = lane.view === 'circuit';
  const isSimulation = lane.view === 'simulation' && !!lane.result?.simulations?.length;
  pre.hidden = isCircuit || isSimulation;
  $(`#${language}-simulation`).hidden = !isSimulation;
  $(`[data-view="simulation"][data-lang="${language}"]`).hidden = !lane.result?.simulations?.length;
  $(`#${language}-output .artifact-bar`).hidden = isSimulation;
  if (isSimulation) lane.simulationView.render(lane.result.simulations,lane.builtCode !== lane.editor.getValue());
  else lane.simulationView.pause();
  $(`#${language}-circuit`).hidden = !isCircuit;
  $(`#${language}-output`).classList.toggle('has-circuit-preview', isCircuit || isSimulation);
  if (isCircuit) lane.circuitPreview.render(artifact?.data, lane.error);
  let text = 'Your blueprint will appear here.\nEdit the code above, then press Run.';
  if (lane.error) text = lane.error;
  else if (lane.view === 'console') text = lane.result ? [...(lane.result.logs ?? []), ...(lane.result.truncated ? ['[Console output truncated at 24 KB]'] : [])].join('\n') || 'Build completed with no console output.' : 'No console output yet.';
  else if (artifact) text = lane.view === 'json' ? JSON.stringify(artifact.data, null, 2) : artifact.string;
  pre.textContent = text; pre.classList.toggle('error', !!lane.error);
  for (const button of document.querySelectorAll(`[data-view][data-lang="${language}"]`)) button.classList.toggle('active', button.dataset.view === lane.view);
  const entities = artifact?.data?.blueprint?.entities ?? [];
  const count = entities.reduce((n, e) => n + (e.control_behavior?.decider_conditions?.conditions?.length ?? 0), 0);
  $(`#${language}-summary`).textContent = artifact && !lane.error ? `${entities.length} ${entities.length === 1 ? 'entity' : 'entities'} · ${count} ${count === 1 ? 'condition' : 'conditions'}${lane.builtCode !== lane.editor.getValue() ? ' · source changed' : ''}` : '';
  actionButton(language, 'copy').disabled = isSimulation || !artifact || !!lane.error;
}

document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.dataset.cookbookLanguage && activeFile?.readonly) {
    const variant = cookbookFiles.find(f => f.id === activeFile.id && f.language === button.dataset.cookbookLanguage);
    if (variant) showFile(variant);
    return;
  }
  const language = button.dataset.lang, action = button.dataset.action;
  if (!language) return;
  if (button.dataset.view) { lanes[language].view = button.dataset.view; renderOutput(language); }
  if (action === 'run') await run(language);
  if (action === 'format') await formatEditor(language);
  if (action === 'stop') lanes[language].runner.stop();
  if (action === 'copy') {
    try { await navigator.clipboard.writeText(selectedArtifact(language).string); notify('Blueprint string copied. Paste it into Factorio’s Import string.'); }
    catch { notify('Clipboard unavailable. Select and copy the string from the Blueprint tab.'); }
  }
  if (action === 'download-source') {
    const url = URL.createObjectURL(new Blob([lanes[language].editor.getValue()], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = activeFile.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});

async function main() {
  const defaults = [];
  for (const example of ['generator']) for (const language of languages) {
    defaults.push({name:`${example}.${language === 'python' ? 'py' : 'ts'}`, language, code:draft(language,example) ?? examples[example][language]});
  }
  // Recover old user-authored drafts without shipping the retired crusher starter.
  for (const language of languages) {
    const code = draft(language, 'crusher');
    if (code !== null) defaults.push({ name: `crusher.${language === 'python' ? 'py' : 'ts'}`, language, code });
  }
  let storage;
  try { storage = localStorage; } catch { storage = {getItem(){throw new Error('Unavailable');}}; }
  const restored = loadWorkspace(storage,defaults);
  workspaceFiles=restored.files;canSaveWorkspace=restored.canSave;
  if(restored.warning)notify(restored.warning);
  persistWorkspace();
  cookbookFiles = Object.entries(import.meta.glob('../cookbook/*.{py,ts}', { query: '?raw', import: 'default', eager: true })).map(([path, code]) => ({ name: path.split('/').at(-1), code, language: path.endsWith('.py') ? 'python' : 'typescript', readonly: true, ...cookbookManifest.find(r => path.endsWith('/'+r.id+'.py') || path.endsWith('/'+r.id+'.ts')) }));
  function restoreFileFromUrl() {
    const linked = fileFromHash(location.hash, workspaceFiles, cookbookFiles);
    const current = workspaceFiles.includes(activeFile) || cookbookFiles.includes(activeFile) ? activeFile : null;
    if (location.hash && !linked) notify('The linked file is not available here. Opened an available file instead.');
    showFile(linked ?? current ?? workspaceFiles[0] ?? cookbookFiles[0], { replaceUrl: true });
  }
  addEventListener('popstate', restoreFileFromUrl);
  addEventListener('hashchange', restoreFileFromUrl);
  restoreFileFromUrl();
  let pendingDelete;
  $('#delete-file').onclick = () => {
    if (!activeFile || activeFile.readonly) return;
    if (!canSaveWorkspace) { notify('Local saving is unavailable. Download your files before deleting.'); return; }
    pendingDelete = activeFile;
    $('#delete-file-message').textContent = `Remove ${pendingDelete.name} from My Files?`;
    $('#delete-file-dialog').returnValue = 'cancel';
    $('#delete-file-dialog').showModal();
  };
  $('#delete-file-dialog').addEventListener('close', () => {
    if ($('#delete-file-dialog').returnValue !== 'delete' || !pendingDelete) return;
    const file = pendingDelete;
    pendingDelete = null;
    try {
      saveDraft(file.language);
      const index = workspaceFiles.indexOf(file);
      workspaceFiles = deleteWorkspaceFile(localStorage, workspaceFiles, file);
      showFile(workspaceFiles[Math.min(index, workspaceFiles.length - 1)] ?? cookbookFiles[0]);
      const state = fileStates.get(file);
      state?.model.dispose(); fileStates.delete(file);
      notify(`Deleted ${file.name}. Undo delete is available in My Files.`);
    } catch (error) { notify(`Could not delete file: ${error.message}`); }
  });
  $('#restore-file').onclick = () => {
    try {
      workspaceFiles = restoreWorkspaceFile(localStorage, workspaceFiles);
      showFile(workspaceFiles.at(-1));
      notify('Deleted file restored.');
    } catch (error) { notify(error.message); }
  };
  $('#copy-example').onclick = () => {
    const original = activeFile; let name = original.name; let suffix = 2;
    while (workspaceFiles.some(f => f.name.toLowerCase() === name.toLowerCase())) name = original.name.replace(/\.(py|ts)$/, `-${suffix++}.$1`);
    addFile(name, original.code);
  };
  $('#cookbook-search').oninput = renderFiles;
  $('#download-workspace').onclick = () => {
    const zip = zipSync(Object.fromEntries(workspaceFiles.map(f=>[f.name,strToU8(f.code)])));
    const url=URL.createObjectURL(new Blob([zip],{type:'application/zip'}));
    const link=document.createElement('a');link.href=url;link.download='circuitmaker-workspace.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('#new-file').onclick = createFile;
  $('#rename-file').onclick = () => { if (activeFile && !activeFile.readonly) openFileDialog(activeFile); };
  $('#upload-file').onclick = () => $('#upload-file-input').click();
  $('#upload-file-input').onchange = async event => {
    const selected = Array.from(event.target.files);
    event.target.value = '';
    if (!selected.length) return;
    const button = $('#upload-file');
    button.disabled = true;
    button.textContent = 'Uploading…';
    let imported = 0, renamed = 0;
    const errors = [];
    try {
      for (const source of selected) {
        try {
          const file = await readSourceFile(source);
          const name = availableUploadName(file.name, workspaceFiles);
          if (addFile(name, file.code)) {
            imported++;
            if (name !== file.name) renamed++;
          }
        } catch (error) { errors.push(`${source.name}: ${error.message}`); }
      }
      const summary = imported ? `Uploaded ${imported} file${imported === 1 ? '' : 's'}.${renamed ? ` Renamed ${renamed} to avoid overwriting existing files.` : ''}` : '';
      notify([summary, ...errors, !canSaveWorkspace && imported ? 'Local saving is unavailable. Download your files to keep them.' : ''].filter(Boolean).join(' '));
    } finally {
      button.disabled = false;
      button.textContent = '↑ Upload';
    }
  };
  $('#cancel-file').onclick = () => $('#new-file-dialog').close();
  $('#new-file-name').oninput = () => $('#new-file-name').setCustomValidity('');
  $('#new-file-language').onchange = () => {
    const extension = $('#new-file-language').value === 'python' ? '.py' : '.ts';
    $('#new-file-extension').textContent = extension;
    const input = $('#new-file-name');
    input.setCustomValidity('');
    if (/^my_circuit(?:-\d+)?$/.test(input.value)) input.value = availableUploadName(`my_circuit${extension}`, workspaceFiles).slice(0, -3);
  };
  $('#new-file-form').onsubmit = submitFileDialog;
  const catalogResponse = await fetch('/signals/catalog.json');
  if (catalogResponse.ok) {
    const catalog = await catalogResponse.json();
    for (const language of languages) {
      attachCatalogCompletion(monaco, lanes[language].editor, language, catalog);
      lanes[language].circuitPreview.setCatalog(catalog);
      lanes[language].simulationView.setCatalog(catalog);
    }
  }
  const pythonStarted = performance.now();
  const tasks = [
    initializePython(monaco, lanes.python.editor).then(language => {
      lanes.python.pythonLanguage = language; lanes.python.intelligenceReady = true;
      $(`#python-intelligence`).textContent = duration(performance.now() - pythonStarted); updateDiagnostics();
    }),
    initializeTypeScript(),
  ];
  const results = await Promise.allSettled(tasks);
  results.forEach((r, i) => { if (r.status === 'rejected') { const language = languages[i]; $(`#${language}-diagnostics`).textContent = 'IntelliSense unavailable'; notify(`${language} IntelliSense: ${r.reason?.message ?? String(r.reason)}`); } });
}
main().catch(error => notify(error.message));
addEventListener('pagehide', () => { pythonFormatter.dispose(); languages.forEach(language => lanes[language].runner.stop()); });

// Keep the sidebar brand aligned with the active file bar, including wrapping.
function alignSidebarBrand() {
  const filebar = activeFile && document.querySelector(`#${activeFile.language}-pane .filebar`);
  if(filebar) document.querySelector('.sidebar-brand').style.height = `${filebar.getBoundingClientRect().height}px`;
}
const barObserver = new ResizeObserver(alignSidebarBrand);
for(const bar of document.querySelectorAll('.filebar'))barObserver.observe(bar);

initializePaneSplitters(document.querySelectorAll('.language-pane'));
