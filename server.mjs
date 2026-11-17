import './build.mjs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createAuth } from './auth.mjs';

const { default: worker } = await import('./dist/server/index.js');
const port = Number(process.env.PORT ?? 3000);
const hosted = Boolean(process.env.RAILWAY_ENVIRONMENT_ID);
const host = hosted ? '0.0.0.0' : '127.0.0.1';
const password = process.env.APP_PASSWORD;
if (hosted && !password) throw new Error('Set APP_PASSWORD in the Railway service variables.');
const authenticate = password
  ? createAuth(password, hosted, await readFile(new URL('public/login.html', import.meta.url), 'utf8'))
  : null;

createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://${host}:${port}`);
    if (authenticate && await authenticate(incoming, outgoing, url.pathname)) return;
    const request = new Request(url, { method: incoming.method, headers: incoming.headers });
    const response = await worker.fetch(request, process.env);
    if (authenticate && url.pathname === '/') response.headers.set('Cache-Control', 'private, no-store');
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch {
    outgoing.writeHead(500).end('Server error');
  }
}).listen(port, host, () => console.log(`Tender Hunter is available at http://${host}:${port}`));
