// Local browser QA only. Uses synthetic data and never calls Apify.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { workerFixture, notices, rail, road, railIds, roadIds } from './worker-fixture.mjs';

let mode = 'partial';
const fixture = await workerFixture(input => {
  const ministry = input.ministry;
  const physical = ministry === rail ? railIds : roadIds;
  if (input.procurementNature) return { items: notices(ministry, physical, physical.length) };
  if (mode === 'partial') return {
    items: notices(ministry, physical.slice(0, ministry === rail ? 3 : 2), ministry === rail ? 33 : 100),
    reason: ministry === rail ? 'run_timeout' : 'max_items',
  };
  return { items: notices(ministry, physical, ministry === rail ? 48 : 180) };
});
fixture.env.APIFY_MAX_ITEMS = '100';
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml' };
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://${incoming.headers.host}`);
    if (url.pathname === '/__fixture' && incoming.method === 'POST') {
      mode = url.searchParams.get('mode') === 'complete' ? 'complete' : 'partial';
      fixture.env.APIFY_MAX_ITEMS = mode === 'complete' ? '5000' : '100';
      outgoing.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ mode }));
    } else if (url.pathname === '/__fixture') {
      outgoing.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ mode, starts: fixture.calls.filter(call => call.input).length }));
    } else if (url.pathname.startsWith('/api/')) {
      const response = await fixture.worker.fetch(new Request(url, { method: incoming.method, headers: incoming.headers }), fixture.env);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)).end(await response.text());
    } else {
      const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!/^[\w.-]+$/.test(path)) { outgoing.writeHead(404).end(); return; }
      const body = await readFile(new URL(`../public/${path}`, import.meta.url));
      outgoing.writeHead(200, { 'Content-Type': types[path.split('.').at(-1)] ?? 'text/plain' }).end(body);
    }
  } catch { outgoing.writeHead(500).end('Fixture error'); }
}).listen(0, '127.0.0.1', () => console.log(`Fixture preview: http://127.0.0.1:${server.address().port} (synthetic data only)`));
