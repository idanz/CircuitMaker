export const WORKSPACE_KEY = 'circuitmaker-workspace:v1';
export const DELETED_FILE_KEY = `${WORKSPACE_KEY}:last-deleted`;
export function lastDeletedFile(storage) {
  try {
    const file = JSON.parse(storage.getItem(DELETED_FILE_KEY));
    return file && typeof file.code === 'string' && typeof file.name === 'string' && /^[\w .-]+\.(py|ts)$/.test(file.name)
      ? { name: file.name, code: file.code, language: file.name.endsWith('.py') ? 'python' : 'typescript' } : null;
  } catch { return null; }
}
export function deleteWorkspaceFile(storage, files, file) {
  if (file.readonly || !files.includes(file)) throw new Error('Only files in My Files can be deleted.');
  const remaining = files.filter(candidate => candidate !== file);
  // Save recovery data before changing the workspace. Failed writes leave the UI intact.
  storage.setItem(DELETED_FILE_KEY, JSON.stringify({ name: file.name, code: file.code }));
  storage.setItem(WORKSPACE_KEY, JSON.stringify(remaining));
  return remaining;
}
export function restoreWorkspaceFile(storage, files) {
  const file = lastDeletedFile(storage);
  if (!file) throw new Error('No deleted file to restore.');
  if (files.some(candidate => candidate.name.toLowerCase() === file.name.toLowerCase())) throw new Error(`A file named ${file.name} already exists.`);
  const restored = [...files, file];
  storage.setItem(WORKSPACE_KEY, JSON.stringify(restored));
  // If clearing recovery fails, retaining the backup is harmless.
  try { storage.setItem(DELETED_FILE_KEY, 'null'); } catch {}
  return restored;
}
export function loadWorkspace(storage, defaults) {
  const fallback = () => defaults.map(f => ({...f}));
  let raw;
  try { raw = storage.getItem(WORKSPACE_KEY); }
  catch { return {files:fallback(),canSave:false,warning:'Local saving is unavailable. Download your files to keep them.'}; }
  if (raw === null) return {files:fallback(),canSave:true};
  try {
    const data=JSON.parse(raw), names=new Set();
    if(!Array.isArray(data))throw new Error('Invalid workspace');
    for(const file of data){
      if(typeof file?.name!=='string'||typeof file.code!=='string'||!/^[\w .-]+\.(py|ts)$/.test(file.name)||names.has(file.name.toLowerCase()))throw new Error('Invalid file');
      names.add(file.name.toLowerCase());
    }
    return {files:data.map(f=>({name:f.name,code:f.code,language:f.name.endsWith('.py')?'python':'typescript'})),canSave:true};
  } catch {
    try { storage.setItem(`${WORKSPACE_KEY}:recovery:${Date.now()}`,raw); }
    catch { return {files:fallback(),canSave:false,warning:'Saved files could not be read. Their stored copy was preserved. Download new edits to keep them.'}; }
    return {files:fallback(),canSave:true,warning:'Saved files could not be read. A recovery copy was kept; your earlier demo drafts are preserved.'};
  }
}
