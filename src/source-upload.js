export async function readSourceFile(file) {
  const name = file.name.replace(/\.(py|ts)$/i, extension => extension.toLowerCase());
  if (!/^[\w .-]+\.(py|ts)$/.test(name)) {
    throw new Error('Use a filename ending in .py or .ts with letters, numbers, spaces, dots, hyphens or underscores.');
  }
  const code = await file.text();
  if (code.includes('\0')) throw new Error('This file contains binary data. Choose a Python or TypeScript source file.');
  return { name, code: code.replace(/^\uFEFF/, '') };
}

export function availableUploadName(name, files) {
  const names = new Set(files.map(file => file.name.toLowerCase()));
  let candidate = name, suffix = 2;
  while (names.has(candidate.toLowerCase())) {
    candidate = name.replace(/\.(py|ts)$/, `-${suffix++}.$1`);
  }
  return candidate;
}
