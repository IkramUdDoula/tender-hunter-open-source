import { createColumnFilters } from './column-filters.js';
import { cachedSearch } from './search-cache.js';

const pageSize = 20;
const locale = { timeZone: 'Asia/Dhaka' };
const dateFormat = new Intl.DateTimeFormat('en-GB', { ...locale, day: '2-digit', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { ...locale, hour: '2-digit', minute: '2-digit' });
const usageCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
const cycleDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const byId = id => document.getElementById(id);
const form = byId('search-form');
const load = byId('load');
const ministry = byId('ministry');
const nature = byId('procurementNature');
const manageFilters = byId('manage-filters');
const chipList = byId('quick-filter-chips');
const filterDialog = byId('filter-dialog');
const quickForm = byId('quick-filter-form');
const quickMinistry = byId('quick-ministry');
const quickNature = byId('quick-nature');
const quickMethod = byId('quick-method');
const filterFeedback = byId('filter-feedback');
const savedList = byId('saved-filters');
const storageKey = 'tender-hunter.quick-filters';
const extraFields = ['keyword', 'organization', 'method', 'publishedSince'];
const rows = byId('rows');
const message = byId('message');
const previous = byId('previous');
const next = byId('next');
const cap = byId('cap');
const cacheNote = byId('cache-note');

let result;
let visibleTenders = [];
let page = 1;
let filtered = false;
let busy = false;
let catalogReady = false;
let savedFilters = [];
let activeFilter;
const columnFilters = createColumnFilters((tenders, hasFilters) => {
  visibleTenders = tenders;
  filtered = hasFilters;
  renderPage(1);
});

function updateControls() {
  ministry.disabled = nature.disabled = manageFilters.disabled = busy || !catalogReady;
  load.disabled = ministry.disabled || !ministry.value;
  for (const [index, chip] of Array.from(chipList.children).entries()) {
    chip.disabled = ministry.disabled;
    chip.setAttribute('aria-pressed', String(savedFilters[index] === activeFilter));
  }
  byId('clear-filter').disabled = busy;
  previous.disabled = busy || page <= 1;
  next.disabled = busy || page * pageSize >= visibleTenders.length;
}

function optionLabel(select, value) {
  return Array.from(select.options).find(option => option.value === value)?.text;
}

function filterDescription(filter) {
  return [
    optionLabel(ministry, filter.ministry),
    optionLabel(nature, filter.procurementNature),
    filter.keyword && `Keyword ${filter.keyword}`,
    filter.organization && `Organization or PE ${filter.organization}`,
    filter.method && `Method ${filter.method}`,
    filter.publishedSince && `Published since ${filter.publishedSince}`,
  ].filter(Boolean).join(' · ');
}

function showActiveFilter(filter) {
  activeFilter = filter;
  const region = byId('active-filter');
  region.hidden = !filter;
  if (filter) byId('active-filter-details').textContent = filterDescription(filter);
}

function renderQuickFilters() {
  chipList.replaceChildren();
  savedList.replaceChildren();
  for (const filter of savedFilters) {
    const details = filterDescription(filter);
    const label = filter.name || details;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.title = details;
    chip.addEventListener('click', () => {
      ministry.value = filter.ministry;
      nature.value = filter.procurementNature;
      showActiveFilter(filter);
      updateControls();
      form.requestSubmit();
    });
    chipList.append(chip);

    const entry = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = label;
    if (filter.name) {
      const criteria = document.createElement('small');
      criteria.textContent = details;
      text.append(criteria);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${label}`);
    remove.addEventListener('click', () => {
      if (storeQuickFilters(savedFilters.filter(saved => saved !== filter), 'Quick filter removed.')) {
        (savedList.querySelector('button') ?? byId('close-filters')).focus();
      }
    });
    entry.append(text, remove);
    savedList.append(entry);
  }
  updateControls();
}

function storeQuickFilters(filters, feedback) {
  filterFeedback.hidden = false;
  try {
    localStorage.setItem(storageKey, JSON.stringify(filters));
  } catch {
    filterFeedback.textContent = 'Quick filters could not be saved in this browser.';
    return false;
  }
  savedFilters = filters;
  if (activeFilter && !filters.includes(activeFilter)) returnToManualFilters();
  filterFeedback.textContent = feedback;
  renderQuickFilters();
  return true;
}

function readQuickFilters() {
  try {
    const filters = JSON.parse(localStorage.getItem(storageKey));
    const fields = ['name', 'ministry', 'procurementNature', ...extraFields];
    if (Array.isArray(filters)) return filters.filter(filter => filter
      && fields.every(field => typeof filter[field] === 'string')
      && filter.ministry && optionLabel(ministry, filter.ministry)
      && optionLabel(nature, filter.procurementNature) && optionLabel(quickMethod, filter.method));
  } catch {
    // A browser without usable storage starts with an empty list.
  }
  return [];
}

function cell(row, value, className = '') {
  const element = row.insertCell();
  element.className = className;
  element.textContent = value ?? '—';
  return element;
}

function dateCell(row, value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.valueOf())) return cell(row);
  const time = document.createElement('time');
  time.dateTime = value;
  time.textContent = dateFormat.format(date);
  const clock = document.createElement('span');
  clock.className = 'time';
  clock.textContent = timeFormat.format(date);
  time.append(clock);
  cell(row, '', 'date').append(time);
}

function noticeCell(row, tender) {
  const target = cell(row);
  let url;
  try { url = new URL(tender.url); } catch { return; }
  if (!['https:', 'http:'].includes(url.protocol)) return;

  const link = document.createElement('a');
  link.className = 'url';
  link.href = url.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open ↗';
  link.setAttribute('aria-label', `Open tender ${tender.id} on e-GP in a new tab`);
  target.replaceChildren(link);
}

function tenderRow(tender) {
  const row = document.createElement('tr');
  cell(row, tender.id, 'tender-id');
  cell(row, tender.title, 'title');
  cell(row, tender.nature);
  cell(row, tender.methodLabel);
  cell(row, tender.ministry);
  cell(row, tender.organization);
  cell(row, tender.procuringEntity);
  dateCell(row, tender.publishedAt);
  dateCell(row, tender.closingAt);
  const status = cell(row);
  if (tender.status) {
    const badge = document.createElement('span');
    badge.className = tender.status.toLowerCase() === 'live' ? 'status live' : 'status';
    badge.textContent = tender.status;
    status.replaceChildren(badge);
  }
  noticeCell(row, tender);
  return row;
}

function showMessage(text, error = false) {
  message.hidden = !text;
  message.classList.toggle('error', error);
  message.textContent = text;
}

function clearResults() {
  result = undefined;
  visibleTenders = [];
  page = 1;
  filtered = false;
  columnFilters.setResults([]);
  rows.replaceChildren();
  cap.hidden = true;
  cacheNote.hidden = true;
  byId('summary').textContent = '20 per page';
  byId('page-number').textContent = 'Page —';
  updateControls();
}

function renderPage(pageNumber) {
  page = pageNumber;
  const total = visibleTenders.length;
  const offset = (page - 1) * pageSize;
  const tenders = visibleTenders.slice(offset, offset + pageSize);
  const count = filtered
    ? `${total.toLocaleString()} ${total === 1 ? 'match' : 'matches'} out of ${result.tenders.length.toLocaleString()}`
    : total.toLocaleString();
  rows.replaceChildren(...tenders.map(tenderRow));
  byId('page-number').textContent = total ? `Page ${page} of ${Math.ceil(total / pageSize)}` : 'Page —';
  byId('summary').textContent = tenders.length
    ? `Showing ${offset + 1}-${offset + tenders.length} of ${count} · 20 per page`
    : `${filtered ? count : '0 tenders'} · 20 per page`;
  const noMatches = filtered ? 'No tenders match these column filters.' : 'No open tenders found for this search.';
  showMessage(tenders.length ? '' : noMatches);
  const { cappedAt } = result;
  cap.hidden = !cappedAt;
  if (cappedAt) cap.textContent = `This search reached the ${cappedAt.toLocaleString()}-notice Apify limit. Narrow the search criteria above to retrieve more specific results.`;
  updateControls();
}

async function request(path, options) {
  const response = await fetch(path, options);
  if (response.status === 401) window.location.assign('/login');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load tenders.');
  return data;
}

async function refreshUsage() {
  const amount = byId('usage-amount');
  const cycle = byId('usage-cycle');
  try {
    const { usedUsd, limitUsd, cycleEndsAt } = await request('/api/usage');
    const usage = `${usageCurrency.format(usedUsd)} used`;
    amount.textContent = limitUsd === null ? usage : `${usage} · ${usageCurrency.format(limitUsd)} limit`;
    const end = new Date(cycleEndsAt);
    cycle.hidden = !cycleEndsAt || Number.isNaN(end.valueOf());
    if (!cycle.hidden) cycle.textContent = `Billing cycle ends ${cycleDate.format(end)} (UTC)`;
  } catch {
    amount.textContent = 'Usage unavailable';
    cycle.hidden = true;
  }
}

async function getBatch(searchId, page) {
  const deadline = Date.now() + 150000;
  const url = `/api/tenders/${searchId}?view=batch&page=${page}`;
  do {
    const data = await request(url);
    if (data.status !== 'loading') return data;
    await new Promise(resolve => setTimeout(resolve, 3000));
  } while (Date.now() < deadline);
  throw new Error('The Apify search did not finish in time. Start a new search to try again.');
}

async function fetchSearch(query) {
  showMessage('Searching for tender notices on Apify.');
  try {
    const { searchId } = await request(`/api/tenders?${query}`, { method: 'POST', headers: { 'X-Tender-Hunter': 'search' } });
    const { tenders, total, cappedAt } = await getBatch(searchId, 1);
    for (let batch = 2; tenders.length < total; batch++) {
      showMessage(`Loading search results (${tenders.length.toLocaleString()} of ${total.toLocaleString()}).`);
      const nextBatch = await getBatch(searchId, batch);
      if (!nextBatch.tenders.length || nextBatch.total !== total) throw new Error('The search results changed. Search again to retry.');
      tenders.push(...nextBatch.tenders);
    }
    if (tenders.length !== total) throw new Error('Could not load all tender results.');
    return { tenders, cappedAt };
  } finally {
    void refreshUsage();
  }
}

async function loadResults(query) {
  busy = true;
  updateControls();
  showMessage('Loading tender results.');
  try {
    const { results, cachedAt } = await cachedSearch(query, () => fetchSearch(query));
    result = results;
    visibleTenders = result.tenders;
    columnFilters.setResults(visibleTenders);
    cacheNote.hidden = cachedAt === undefined;
    if (cachedAt !== undefined) cacheNote.textContent = `Browser cache · Saved ${dateFormat.format(cachedAt)}, ${timeFormat.format(cachedAt)} (Bangladesh time)`;
    renderPage(1);
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (load.disabled) return;
  const query = new URLSearchParams({ ministry: ministry.value });
  if (nature.value) query.set('procurementNature', nature.value);
  for (const field of extraFields) if (activeFilter?.[field]) query.set(field, activeFilter[field]);
  clearResults();
  loadResults(query);
});

manageFilters.addEventListener('click', () => {
  quickForm.reset();
  quickMinistry.value = ministry.value;
  quickNature.value = nature.value;
  filterFeedback.hidden = true;
  filterDialog.showModal();
});
byId('close-filters').addEventListener('click', () => filterDialog.close());
quickForm.addEventListener('submit', event => {
  event.preventDefault();
  const filter = Object.fromEntries(Array.from(new FormData(quickForm), ([field, value]) => [field, value.trim()]));
  const criteria = ['ministry', 'procurementNature', ...extraFields];
  if (savedFilters.some(saved => criteria.every(field => saved[field] === filter[field]))) {
    filterFeedback.hidden = false;
    filterFeedback.textContent = 'This quick filter is already saved.';
    return;
  }
  storeQuickFilters([...savedFilters, filter], 'Quick filter saved.');
});

function returnToManualFilters() {
  showActiveFilter();
  clearResults();
  showMessage(ministry.value ? 'Select Search tenders to apply your filters.' : 'Choose a ministry to search for tenders.');
}

for (const select of [ministry, nature]) select.addEventListener('change', returnToManualFilters);
byId('clear-filter').addEventListener('click', returnToManualFilters);
previous.addEventListener('click', () => renderPage(page - 1));
next.addEventListener('click', () => renderPage(page + 1));

request('/api/catalog').then(({ catalog, procurementMethods, loginEnabled }) => {
  byId('sign-out').hidden = !loginEnabled;
  for (const { name, id } of catalog.ministry) ministry.append(new Option(name, id));
  quickMinistry.append(...Array.from(ministry.options, option => option.cloneNode(true)));
  quickNature.append(...Array.from(nature.options, option => option.cloneNode(true)));
  for (const method of procurementMethods) quickMethod.append(new Option(method, method));
  catalogReady = true;
  savedFilters = readQuickFilters();
  renderQuickFilters();
}).catch(() => showMessage('Could not load the ministry list. Reload the page to try again.', true));
refreshUsage();
