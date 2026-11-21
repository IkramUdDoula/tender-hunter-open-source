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
const ministries = new Map([['all', 'All ministries']]);
const ministry = ministryPicker('ministry', returnToManualFilters);
const nature = byId('procurementNature');
const manageFilters = byId('manage-filters');
const chipList = byId('quick-filter-chips');
const filterDialog = byId('filter-dialog');
const quickForm = byId('quick-filter-form');
const quickMinistry = ministryPicker('quick-ministry', updateQuickSave);
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
const progress = byId('search-progress');
const progressBar = byId('search-progress-bar');
const progressLabel = byId('search-progress-label');
const searchFailures = byId('search-failures');

let result;
let visibleTenders = [];
let page = 1;
let filtered = false;
let busy = false;
let remainingSearches = 0;
let catalogReady = false;
let savedFilters = [];
let activeFilter;
const columnFilters = createColumnFilters((tenders, hasFilters) => {
  visibleTenders = tenders;
  filtered = hasFilters;
  renderPage(1);
});

function updateControls() {
  const disabled = busy || !catalogReady;
  ministry.disable(disabled);
  nature.disabled = manageFilters.disabled = disabled;
  load.disabled = disabled || !ministry.values.length;
  for (const [index, chip] of Array.from(chipList.children).entries()) {
    chip.disabled = disabled;
    chip.setAttribute('aria-pressed', String(savedFilters[index] === activeFilter));
  }
  byId('clear-filter').disabled = busy;
  previous.disabled = page <= 1;
  next.disabled = page * pageSize >= visibleTenders.length;
}

function ministryPicker(id, onChange) {
  const button = byId(id);
  const panel = byId(`${id}-options`);
  const choices = new Map();
  let selected = [];

  function toggle(open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  function set(values) {
    selected = values.includes('all') ? ['all'] : [...new Set(values)];
    for (const [value, checkbox] of choices) checkbox.checked = selected.includes(value);
    button.textContent = selected.length > 1 ? `${selected.length} ministries selected` : ministries.get(selected[0]) ?? 'Select ministries';
  }

  button.addEventListener('click', () => toggle(panel.hidden));
  function closeOnEscape(event) {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    toggle(false);
    button.focus();
  }
  button.addEventListener('keydown', closeOnEscape);
  panel.addEventListener('keydown', closeOnEscape);

  return {
    get values() { return selected; },
    set,
    close: () => toggle(false),
    disable(disabled) {
      button.disabled = disabled;
      if (disabled) toggle(false);
    },
    populate() {
      for (const [value, name] of ministries) {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', () => {
          const next = selected.filter(item => item !== value && item !== 'all');
          if (checkbox.checked) next.push(value);
          set(next);
          onChange();
        });
        choices.set(value, checkbox);
        label.append(checkbox, name);
        panel.append(label);
      }
    },
  };
}

function updateQuickSave() {
  byId('save-quick-filter').disabled = !quickMinistry.values.length;
}

function optionLabel(select, value) {
  return Array.from(select.options).find(option => option.value === value)?.text;
}

function filterDescription(filter) {
  return [
    filter.ministries.map(id => ministries.get(id)).join(', '),
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
      ministry.set(filter.ministries);
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
    if (!Array.isArray(filters)) return [];
    const fields = ['name', 'procurementNature', ...extraFields];
    return filters.flatMap(filter => {
      if (!filter || !fields.every(field => typeof filter[field] === 'string')
        || !optionLabel(nature, filter.procurementNature) || !optionLabel(quickMethod, filter.method)) return [];
      const { ministry: legacyMinistry, ministries: savedMinistries, ...criteria } = filter;
      const values = Array.isArray(savedMinistries) ? savedMinistries : [legacyMinistry];
      const valid = [...new Set(values.filter(id => ministries.has(id)))];
      if (!valid.length) return [];
      return [{ ...criteria, ministries: valid.includes('all') ? ['all'] : valid }];
    });
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
  remainingSearches = 0;
  visibleTenders = [];
  page = 1;
  filtered = false;
  columnFilters.setResults([], true);
  rows.replaceChildren();
  cap.hidden = true;
  cacheNote.hidden = true;
  progress.hidden = true;
  searchFailures.hidden = true;
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
  showMessage(tenders.length || remainingSearches ? '' : noMatches);
  const { cappedAt, cappedSearches } = result;
  cap.hidden = !cappedSearches;
  if (cappedSearches) {
    const limit = cappedSearches === 1
      ? `One search reached the ${cappedAt.toLocaleString()}-notice Apify limit per search.`
      : `${cappedSearches} searches reached their Apify notice limits.`;
    cap.textContent = `${limit} Narrow the criteria above to retrieve more specific results.`;
  }
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
  const { searchId } = await request(`/api/tenders?${query}`, { method: 'POST', headers: { 'X-Tender-Hunter': 'search' } });
  const { tenders, total, cappedAt } = await getBatch(searchId, 1);
  for (let batch = 2; tenders.length < total; batch++) {
    const nextBatch = await getBatch(searchId, batch);
    if (!nextBatch.tenders.length || nextBatch.total !== total) throw new Error('The search results changed. Search again to retry.');
    tenders.push(...nextBatch.tenders);
  }
  if (tenders.length !== total) throw new Error('Could not load all tender results.');
  return { tenders, cappedAt };
}

async function loadResults(baseQuery, selected) {
  result = { tenders: [], cappedAt: null, cappedSearches: 0 };
  remainingSearches = selected.length;
  busy = true;
  updateControls();
  showMessage('');
  progressBar.max = selected.length;
  progressBar.value = 0;
  progress.hidden = false;
  const failures = [];
  const cacheDates = [];
  let requestedApify = false;

  try {
    for (const [index, id] of selected.entries()) {
      const name = ministries.get(id);
      progressLabel.textContent = `Loading ${name} (${index + 1} of ${selected.length})`;
      const query = new URLSearchParams(baseQuery);
      query.set('ministry', id);
      try {
        const { results, cachedAt } = await cachedSearch(query, () => {
          requestedApify = true;
          return fetchSearch(query);
        });
        result.tenders = result.tenders.concat(results.tenders);
        if (results.cappedAt) {
          result.cappedAt = results.cappedAt;
          result.cappedSearches++;
        }
        if (cachedAt !== undefined) cacheDates.push(cachedAt);
      } catch (error) {
        failures.push(`${name} (${error.message})`);
        searchFailures.textContent = `Could not load ${failures.join('; ')}`;
        searchFailures.hidden = false;
      }
      remainingSearches--;
      progressBar.value = index + 1;
      visibleTenders = columnFilters.setResults(result.tenders);
      renderPage(page);
    }
    const completed = selected.length - failures.length;
    const failureCount = failures.length ? ` · ${failures.length} failed` : '';
    progress.hidden = selected.length === 1;
    progressLabel.textContent = `${completed} of ${selected.length} ministries loaded${failureCount}`;
    if (!completed) showMessage('');
    if (cacheDates.length) {
      cacheNote.hidden = false;
      const cachedAt = cacheDates[0];
      cacheNote.textContent = selected.length === 1
        ? `Browser cache · Saved ${dateFormat.format(cachedAt)}, ${timeFormat.format(cachedAt)} (Bangladesh time)`
        : `Browser cache · ${cacheDates.length} of ${selected.length} searches reused`;
    }
  } finally {
    busy = false;
    updateControls();
    if (requestedApify) void refreshUsage();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (load.disabled) return;
  const query = new URLSearchParams();
  if (nature.value) query.set('procurementNature', nature.value);
  for (const field of extraFields) if (activeFilter?.[field]) query.set(field, activeFilter[field]);
  clearResults();
  loadResults(query, [...ministry.values]);
});

manageFilters.addEventListener('click', () => {
  quickForm.reset();
  quickMinistry.set(ministry.values);
  quickMinistry.close();
  updateQuickSave();
  quickNature.value = nature.value;
  filterFeedback.hidden = true;
  filterDialog.showModal();
});
byId('close-filters').addEventListener('click', () => filterDialog.close());
quickForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!quickMinistry.values.length) return;
  const filter = {
    ...Object.fromEntries(Array.from(new FormData(quickForm), ([field, value]) => [field, value.trim()])),
    ministries: [...quickMinistry.values],
  };
  const criteria = ['procurementNature', ...extraFields];
  if (savedFilters.some(saved => saved.ministries.length === filter.ministries.length
    && saved.ministries.every(id => filter.ministries.includes(id))
    && criteria.every(field => saved[field] === filter[field]))) {
    filterFeedback.hidden = false;
    filterFeedback.textContent = 'This quick filter is already saved.';
    return;
  }
  storeQuickFilters([...savedFilters, filter], 'Quick filter saved.');
});

function returnToManualFilters() {
  showActiveFilter();
  clearResults();
  showMessage(ministry.values.length ? 'Select Search tenders to apply your filters.' : 'Choose ministries to search for tenders.');
}

nature.addEventListener('change', returnToManualFilters);
byId('clear-filter').addEventListener('click', returnToManualFilters);
previous.addEventListener('click', () => renderPage(page - 1));
next.addEventListener('click', () => renderPage(page + 1));

request('/api/catalog').then(({ catalog, procurementMethods, loginEnabled }) => {
  byId('sign-out').hidden = !loginEnabled;
  for (const { name, id } of catalog.ministry) ministries.set(id, name);
  ministry.populate();
  quickMinistry.populate();
  quickNature.append(...Array.from(nature.options, option => option.cloneNode(true)));
  for (const method of procurementMethods) quickMethod.append(new Option(method, method));
  catalogReady = true;
  savedFilters = readQuickFilters();
  renderQuickFilters();
}).catch(() => showMessage('Could not load the ministry list. Reload the page to try again.', true));
refreshUsage();
