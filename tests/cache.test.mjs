import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { isCompleteSearch } from '../public/search-status.js';

async function cacheFixture() {
  const entries = new Map();
  const request = action => {
    const result = {};
    queueMicrotask(() => { result.result = action(); result.onsuccess?.(); });
    return result;
  };
  const db = {
    transaction() {
      const transaction = { objectStore: () => ({
        get: key => request(() => entries.get(key)),
        put(value, key) { entries.set(key, structuredClone(value)); queueMicrotask(() => transaction.oncomplete?.()); },
        delete(key) { entries.delete(key); queueMicrotask(() => transaction.oncomplete?.()); },
        index: () => ({ openCursor: () => request(() => null) }),
      }) };
      return transaction;
    },
  };
  const source = await readFile(new URL('../public/search-cache.js', import.meta.url), 'utf8');
  const context = vm.createContext({ isCompleteSearch, URLSearchParams, Date, Promise,
    navigator: {}, IDBKeyRange: { upperBound: value => value },
    indexedDB: { open: () => request(() => db) },
  });
  new vm.Script(source.replace(/^import .*;\r?\n/m, '').replace('export async function cachedSearch', 'async function cachedSearch')
    + '\nglobalThis.search = cachedSearch;').runInContext(context);
  return { search: context.search, entries };
}
const complete = { tenders: [{ id: '1364024' }], complete: true, stopReason: 'end_of_list', cappedAt: null };

test('award and tender searches and signing-date criteria never share cached datasets', async () => {
  const { search } = await cacheFixture();
  let calls = 0;
  const fetch = async () => { calls++; return complete; };
  const queries = ['recordType=tenders&ministry=all', 'recordType=awards&ministry=all',
    'recordType=awards&ministry=all&signedSince=2026-11-01', 'recordType=awards&ministry=all&district=Dhaka'];
  for (const query of queries) await search(new URLSearchParams(query), fetch);
  assert.equal(calls, 4);
  for (const query of queries) assert.equal(typeof (await search(new URLSearchParams(query), fetch)).cachedAt, 'number');
  assert.equal(calls, 4);
});

test('old cached results are bypassed, confirmed results are reused, and refresh bypasses them', async () => {
  const { search, entries } = await cacheFixture();
  entries.set('ministry=162', { expiresAt: Date.now() + 60000, results: { tenders: [], cappedAt: null } });
  let calls = 0;
  const fetch = async () => { calls++; return complete; };
  const query = new URLSearchParams('ministry=162');
  const first = await search(query, fetch);
  assert.equal(first.cachedAt, undefined);
  const second = await search(query, fetch);
  assert.equal(calls, 1);
  assert.equal(typeof second.cachedAt, 'number');
  await search(query, fetch, { refresh: true });
  assert.equal(calls, 2);
});

test('partial or unverified searches are never reused, including after a refresh', async () => {
  for (const results of [
    { ...complete, complete: false, stopReason: 'run_timeout' },
    { ...complete, complete: false, stopReason: 'max_items', cappedAt: 100 },
    { tenders: [], cappedAt: null },
  ]) {
    const { search, entries } = await cacheFixture();
    const query = new URLSearchParams('ministry=162');
    await search(query, async () => complete);
    await search(query, async () => results, { refresh: true });
    assert.equal(entries.size, 0);
    let calls = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await search(query, async () => { calls++; return results; });
      assert.equal(response.cachedAt, undefined);
    }
    assert.equal(calls, 2);
  }
});
