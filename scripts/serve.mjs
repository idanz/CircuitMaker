import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.argv[2] ?? 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.py': 'text/plain; charset=utf-8', '.pyi': 'text/plain; charset=utf-8', '.png': 'image/png', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.zip': 'application/zip' };
const policies = new Map();
let pattern;
for (const line of (await readFile(path.join(root, '_headers'), 'utf8')).split(/\r?\n/)) {
  if (line.startsWith('/')) { pattern = line; policies.set(pattern, {}); }
  else if (line.trim() && pattern) { const i = line.indexOf(':'); policies.get(pattern)[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
}
http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    const info = await stat(file); if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': info.size, ...policies.get('/*'), ...policies.get(pathname) });
    response.end(request.method === 'HEAD' ? undefined : await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`CircuitMaker Language Lab: http://127.0.0.1:${port}`));
