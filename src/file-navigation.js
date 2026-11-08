// Separate scopes avoid confusing editable copies with readonly cookbook files.
export function fileSelectionHash(file) {
  return `#${file.readonly ? 'cookbook' : 'workspace'}/${encodeURIComponent(file.name)}`;
}

export function fileFromHash(hash, workspace, cookbook) {
  const match = /^#(workspace|cookbook)\/(.+)$/.exec(hash);
  if (!match) return undefined;
  try {
    const name = decodeURIComponent(match[2]);
    return (match[1] === 'cookbook' ? cookbook : workspace).find(file => file.name === name);
  } catch {
    return undefined;
  }
}
