// Dev-only static server (not deployed): serves poc/web/ under /poc/ on
// http://127.0.0.1:4173 so relative assets and the extensionless consent
// route can be smoke-tested locally. Node builtins only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const routes = new Map([
  ['/poc/', ['index.html']],
  ['/poc/index.html', ['index.html']],
  ['/poc/oauth/consent', ['oauth', 'consent.html']],
  ['/poc/oauth/consent.html', ['oauth', 'consent.html']],
]);

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1:4173').pathname;
  let parts = routes.get(path);
  if (!parts && path.startsWith('/poc/assets/')) {
    const name = normalize(path.slice('/poc/'.length)).replace(/^(\.\.[/\\])+/, '');
    parts = name.split(/[/\\]/);
  }
  if (!parts) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
  try {
    const body = await readFile(join(webRoot, ...parts));
    res.writeHead(200, { 'Content-Type': types[extname(parts[parts.length - 1])] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Serving poc/web at http://127.0.0.1:4173/poc/'));
