import assert from 'node:assert/strict';
import test from 'node:test';
import { workerFixture, rail, road } from './worker-fixture.mjs';
import { formatCalendarDate, formatContractValue, recordKey } from '../public/records.js';
import { matchesFilter } from '../public/column-filters.js';

const award = (lotId, ministry = rail) => ({
  recordType: 'award', tenderId: 'fixture-tender', lotId, title: 'Fixture toll system', ministry,
  procuringEntity: 'Fixture procurement office', district: 'Dhaka', method: 'RFQU', methodLabel: null,
  winnerName: 'Fixture Systems Ltd', contractSignedOn: '2026-11-01', advertisedAt: '2026-10-01T10:00:00+06:00',
  contractValueBdt: 12780000, contractValueCrore: 1.278, contractValueText: '1.278',
  detailUrl: 'https://www.eprocure.gov.bd/resources/common/ViewAwardedContracts.jsp?pkgLotId=fixture',
});

test('award filters reach Apify and award fields survive exact-ministry and all-ministry paging', async () => {
  const items = [award('lot-a'), award('lot-b'), award('lot-c', road)];
  const fixture = await workerFixture(() => ({ items }));
  for (const ministry of ['162', 'all']) {
    const { searchId } = await fixture.start(`recordType=awards&ministry=${ministry}&keyword=toll&signedSince=2026-01-01&district=Dhaka&method=RFQU`);
    const response = await fixture.page(searchId);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.recordType, 'awards');
    assert.equal(data.complete, true);
    assert.equal(data.total, ministry === 'all' ? 3 : 2);
    assert.deepEqual(data.tenders.map(row => row.lotId), ministry === 'all' ? ['lot-a', 'lot-b', 'lot-c'] : ['lot-a', 'lot-b']);
    const row = data.tenders[0];
    assert.equal(row.recordType, 'award');
    assert.equal(row.winnerName, 'Fixture Systems Ltd');
    assert.equal(row.contractValueBdt, 12780000);
    assert.equal(row.contractValueText, '1.278');
    assert.equal(row.contractSignedOn, '2026-11-01');
    assert.equal(row.methodLabel, 'RFQU');
    assert.equal(row.closingAt, undefined);
    assert.equal(new Set(data.tenders.map(recordKey)).size, data.total);
  }
  for (const { input } of fixture.calls.filter(call => call.input)) {
    assert.equal(input.recordType, 'awards');
    assert.equal(input.signedSince, '2026-01-01');
    assert.equal(input.district, 'Dhaka');
    assert.equal(input.keyword, 'toll');
    assert.equal(input.method, 'RFQU');
    assert.equal(input.procurementNature, undefined);
    assert.equal(input.publishedSince, undefined);
  }
});

test('invalid record types and incompatible filters are rejected before a paid run starts', async () => {
  const fixture = await workerFixture(() => ({ items: [] }));
  for (const query of ['recordType=invalid', 'recordType=awards&procurementNature=goods', 'recordType=awards&publishedSince=7days',
    'recordType=tenders&signedSince=2026-01-01', 'district=Dhaka', `recordType=awards&district=${'a'.repeat(101)}`]) {
    const response = await fixture.request(`/api/tenders?ministry=all&${query}`, { method: 'POST', headers: { 'X-Tender-Hunter': 'search' } });
    assert.equal(response.status, 400, query);
  }
  assert.equal(fixture.calls.length, 0);
});

test('award caps remain partial and non-BDT or missing numeric values remain null', async () => {
  const fixture = await workerFixture(() => ({ items: [{ ...award('one'), contractValueBdt: null, contractValueText: 'USD 150' }], reason: 'max_items' }));
  fixture.env.APIFY_MAX_ITEMS = '1';
  const { searchId } = await fixture.start('recordType=awards&ministry=all');
  const data = await (await fixture.page(searchId)).json();
  assert.equal(data.complete, false);
  assert.equal(data.stopReason, 'max_items');
  assert.equal(data.cappedAt, 1);
  assert.equal(data.tenders[0].contractValueBdt, null);
  assert.equal(formatContractValue(data.tenders[0]), 'USD 150');
});

test('saved award keys distinguish lots and live notices while retaining legacy tender keys', () => {
  const live = { id: '123' };
  const one = { ...live, recordType: 'award', lotId: '1' };
  const two = { ...one, lotId: '2' };
  assert.equal(recordKey(live), '123');
  assert.equal(new Set([live, one, two].map(recordKey)).size, 3);
  assert.equal(recordKey({ ...one, lotId: null }), '');
});

test('calendar dates do not shift timezone and date ranges include the whole signing day', () => {
  assert.equal(formatCalendarDate('2026-11-01'), '01 Nov 2026');
  assert.equal(formatCalendarDate('2026-02-30'), '-');
  assert.equal(formatCalendarDate(null), '-');
  const range = { from: '2026-11-01', to: '2026-11-01' };
  assert.equal(matchesFilter('2026-11-01', range), true);
  assert.equal(matchesFilter('2026-10-31', range), false);
  assert.equal(matchesFilter('2026-11-02', range), false);
  assert.equal(matchesFilter('2026-11-01T23:59:59+06:00', range), true);
  assert.equal(matchesFilter(null, range), false);
});

test('contract value ranges include boundaries and exclude unknown currencies and amounts', () => {
  const range = { min: '0', max: '12780000' };
  assert.equal(matchesFilter(0, range), true);
  assert.equal(matchesFilter(12780000, range), true);
  for (const value of [12780001, null, undefined, '', 'USD 150', NaN]) assert.equal(matchesFilter(value, range), false);
});
