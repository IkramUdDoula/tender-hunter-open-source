import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export const rail = 'Ministry of Railways';
export const road = 'Ministry of Road Transport and Bridges';
export const railIds = ['1372585', '1372584', '1370228', '1364024'];
export const roadIds = ['1377616', '1372752', '1369803', '1358061', '1363347', '1355056', '1353270'];

export function notices(ministry, physicalIds, total) {
  return Array.from({ length: total }, (_, index) => ({
    tenderId: physicalIds[index] ?? `fixture-${ministry === rail ? 'rail' : 'road'}-${index}`,
    title: `Test notice ${index + 1}`, ministry,
    procurementNature: index < physicalIds.length ? 'physicalServices' : 'goods',
    procurementNatureLabel: index < physicalIds.length ? 'Physical Services' : 'Goods',
    status: 'Live', publishedAt: '2026-11-20T12:00:00+06:00', closingAt: '2026-12-15T12:00:00+06:00',
  }));
}

export async function workerFixture(scenario) {
  const source = await readFile(new URL('../worker.mjs', import.meta.url), 'utf8');
  const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'));
  const runs = new Map();
  const calls = [];
  const fetch = async (address, options) => {
    const url = new URL(address);
    calls.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), input: options.body && JSON.parse(options.body) });
    if (url.pathname.endsWith('/runs')) {
      const id = `run-${runs.size}`;
      runs.set(id, await scenario(JSON.parse(options.body), calls));
      return Response.json({ data: { id } });
    }
    const id = url.pathname.split('/').at(url.pathname.endsWith('/items') ? -2 : -1);
    const run = runs.get(id);
    if (!run) throw new Error(`Unexpected fixture endpoint ${url.pathname}`);
    if (url.pathname.includes('/actor-runs/')) {
      return Response.json({ data: { status: run.status ?? 'SUCCEEDED', defaultDatasetId: id } });
    }
    if (url.pathname.includes('/logs/')) {
      if (run.logError) return new Response('Unavailable', { status: 403 });
      const counts = run.counts ?? { items: run.items.length, invalid: 0, stopReason: run.reason ?? 'end_of_list' };
      return new Response(run.log ?? `2026-11-23T09:00:48.969Z INFO Run finished ${JSON.stringify({ counts, seconds: 82 })}\n`);
    }
    if (url.pathname.endsWith('/items')) {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit'));
      const fields = url.searchParams.get('fields').split(',');
      const items = run.items.slice(offset, offset + limit).map(item =>
        Object.fromEntries(Object.entries(item).filter(([key]) => fields.includes(key))));
      return Response.json(items, { headers: { 'X-Apify-Pagination-Total': String(run.items.length) } });
    }
    throw new Error(`Unexpected fixture endpoint ${url.pathname}`);
  };
  const context = vm.createContext({ catalog, assets: {}, fetch, Request, Response, URL, URLSearchParams, crypto, AbortSignal });
  new vm.Script(source.replace('export default {', 'globalThis.worker = {')).runInContext(context);
  const env = { APIFY_TOKEN: 'test-fixture' };
  const request = (path, options) => context.worker.fetch(new Request(`http://fixture${path}`, options), env);
  async function start(query = 'ministry=162') {
    const response = await request(`/api/tenders?${query}`, { method: 'POST', headers: { 'X-Tender-Hunter': 'search' } });
    if (response.status !== 202) throw new Error(`Fixture start failed: ${await response.text()}`);
    return response.json();
  }
  async function page(searchId, number = 1, batch = true) {
    return request(`/api/tenders/${searchId}?page=${number}${batch ? '&view=batch' : ''}`);
  }
  return { worker: context.worker, env, calls, start, page, request };
}
