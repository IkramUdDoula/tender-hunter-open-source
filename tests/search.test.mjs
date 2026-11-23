import assert from 'node:assert/strict';
import test from 'node:test';
import { workerFixture, notices, rail, road, railIds, roadIds } from './worker-fixture.mjs';
import { isCompleteSearch, partialSearchMessage } from '../public/search-status.js';

test('a SUCCEEDED timeout run is partial even below the record limit', async () => {
  const fixture = await workerFixture(() => ({ items: notices(rail, railIds.slice(0, 3), 33), reason: 'run_timeout' }));
  const start = await fixture.start();
  assert.equal(start.timeoutSeconds, 600);
  assert.equal(fixture.calls[0].query.timeout, '600');
  assert.equal(fixture.calls[0].input.maxItems, 5000);
  const response = await fixture.page(start.searchId);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.total, 33);
  assert.equal(data.complete, false);
  assert.equal(data.stopReason, 'run_timeout');
  assert.equal(data.cappedAt, null);
  assert.equal(isCompleteSearch(data), false);
  assert.match(partialSearchMessage([{ name: rail, ...data }]), /Partial results.*stopped before all notices.*more matches/);
});

test('explicit item and runtime budgets remain enforced and labelled', async () => {
  const fixture = await workerFixture(() => ({ items: notices(road, roadIds.slice(0, 2), 100), reason: 'max_items' }));
  fixture.env.APIFY_MAX_ITEMS = '100';
  fixture.env.APIFY_TIMEOUT_SECONDS = '180';
  const start = await fixture.start('ministry=8');
  assert.equal(start.timeoutSeconds, 180);
  assert.equal(fixture.calls[0].input.maxItems, 100);
  const data = await (await fixture.page(start.searchId)).json();
  assert.equal(data.complete, false);
  assert.equal(data.stopReason, 'max_items');
  assert.equal(data.cappedAt, 100);
  assert.match(partialSearchMessage([{ name: road, ...data }]), /100-notice limit/);
});

test('a verified full broad search contains the same Physical Services as a targeted search', async () => {
  const fixture = await workerFixture(input => {
    const ministry = input.ministry;
    const ids = ministry === rail ? railIds : roadIds;
    return { items: notices(ministry, ids, input.procurementNature ? ids.length : ministry === rail ? 48 : 180) };
  });
  const ids = async query => {
    const { searchId } = await fixture.start(query);
    const data = await (await fixture.page(searchId)).json();
    assert.equal(isCompleteSearch(data), true);
    return data.tenders.filter(tender => tender.nature === 'Physical Services').map(tender => tender.id);
  };
  const broad = [...await ids('ministry=162'), ...await ids('ministry=8')];
  const narrow = [...await ids('ministry=162&procurementNature=physicalServices'), ...await ids('ministry=8&procurementNature=physicalServices')];
  assert.deepEqual(broad, narrow);
  assert.equal(broad.length, 11);
  assert.equal(fixture.calls.filter(call => call.input?.procurementNature === 'physicalServices').length, 2);
});

for (const scenario of [
  { name: 'missing summary', log: 'INFO Starting run\n' },
  { name: 'malformed summary', log: 'INFO Run finished {broken}\n' },
  { name: 'inaccessible log', logError: true },
  { name: 'count mismatch', counts: { items: 49, invalid: 0, stopReason: 'end_of_list' } },
  { name: 'invalid records', counts: { items: 48, invalid: 1, stopReason: 'end_of_list' } },
  { name: 'unfamiliar stop reason', reason: 'future_reason' },
]) test(`${scenario.name} never claims completeness`, async () => {
  const fixture = await workerFixture(() => ({ items: notices(rail, railIds, 48), ...scenario }));
  const { searchId } = await fixture.start();
  const data = await (await fixture.page(searchId)).json();
  assert.equal(data.total, 48);
  assert.equal(data.complete, false);
  assert.equal(data.stopReason, 'unknown');
});

test('a verified complete result exactly at the limit is complete', async () => {
  const fixture = await workerFixture(() => ({ items: notices(rail, railIds, 100) }));
  fixture.env.APIFY_MAX_ITEMS = '100';
  const { searchId } = await fixture.start();
  const data = await (await fixture.page(searchId)).json();
  assert.equal(isCompleteSearch(data), true);
});

test('empty timeout results cannot be mistaken for no matching tenders', async () => {
  const fixture = await workerFixture(() => ({ items: [], reason: 'run_timeout' }));
  const { searchId } = await fixture.start();
  const data = await (await fixture.page(searchId)).json();
  assert.equal(data.total, 0);
  assert.equal(data.complete, false);
  assert.equal(data.stopReason, 'run_timeout');
});

test('exact-ministry filtering and all batch pages preserve completeness and IDs', async () => {
  const items = notices(rail, railIds, 620);
  items.splice(10, 0, ...notices(road, roadIds, 7));
  const fixture = await workerFixture(() => ({ items }));
  for (const ministry of ['162', 'all']) {
    const { searchId } = await fixture.start(`ministry=${ministry}`);
    const expected = items.filter(item => ministry === 'all' || item.ministry === rail).map(item => item.tenderId);
    for (const batch of [true, false]) {
      const received = [];
      for (let page = 1; received.length < expected.length; page++) {
        const data = await (await fixture.page(searchId, page, batch)).json();
        assert.equal(isCompleteSearch(data), true);
        assert.equal(data.total, expected.length);
        assert.ok(data.tenders.length);
        received.push(...data.tenders.map(tender => tender.id));
      }
      assert.deepEqual(received, expected);
    }
  }
});

test('running and failed upstream runs retain their API behavior', async () => {
  for (const [status, expected] of [['RUNNING', 202], ['FAILED', 502], ['TIMED-OUT', 502]]) {
    const fixture = await workerFixture(() => ({ items: [], status }));
    const { searchId } = await fixture.start();
    assert.equal((await fixture.page(searchId)).status, expected);
  }
});
