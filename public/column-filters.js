const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const number = new Intl.NumberFormat();
const day = 24 * 60 * 60 * 1000;
const valueText = value => String(value ?? '').trim();
const searchText = value => valueText(value).normalize('NFKC').toLowerCase();

function input(id, label, type, value = '') {
  const field = document.createElement('label');
  field.className = 'column-filter-field';
  field.htmlFor = id;
  field.textContent = label;
  const control = document.createElement('input');
  Object.assign(control, { id, type, value });
  field.append(control);
  return [field, control];
}

function textEditor(current, content) {
  const field = document.createElement('label');
  field.className = 'column-filter-field';
  field.textContent = 'Match';
  const match = document.createElement('select');
  match.append(new Option('Contains', 'contains'), new Option('Is exactly', 'exact'));
  match.value = current?.mode ?? 'contains';
  field.append(match);
  const [queryField, query] = input('column-query', 'Value', 'text', current?.query);
  query.required = true;
  query.addEventListener('input', () => query.setCustomValidity(''));
  content.append(field, queryField);
  return {
    focus: query,
    read() {
      const value = query.value.trim();
      query.setCustomValidity(value ? '' : 'Enter a value.');
      if (query.reportValidity()) return { mode: match.value, query: value };
    },
  };
}

function dateEditor(current, content) {
  const range = document.createElement('div');
  range.className = 'column-filter-range';
  const [fromField, from] = input('column-from', 'From', 'date', current?.from);
  const [toField, to] = input('column-to', 'Through', 'date', current?.to);
  const hint = document.createElement('p');
  hint.className = 'column-filter-hint';
  hint.textContent = 'Dates are inclusive and use Bangladesh time.';
  range.append(fromField, toField);
  content.append(range, hint);
  for (const control of [from, to]) control.addEventListener('input', () => {
    from.setCustomValidity('');
    to.setCustomValidity('');
  });
  return {
    focus: from,
    read() {
      from.setCustomValidity(from.value || to.value ? '' : 'Enter a start or end date.');
      to.setCustomValidity(from.value && to.value && to.value < from.value ? 'Choose an end date on or after the start date.' : '');
      if (from.reportValidity() && to.reportValidity()) return { from: from.value, to: to.value };
    },
  };
}

function valuesEditor(current, content, counts, apply) {
  const selected = new Set(current?.values);
  for (const value of selected) if (!counts.has(value)) counts.set(value, 0);
  const options = [...counts].sort(([left], [right]) => collator.compare(left || '(Blank)', right || '(Blank)'));
  const [searchField, search] = input('column-value-search', 'Find a value', 'search');
  const list = document.createElement('div');
  list.className = 'column-filter-values';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', 'Available values');
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'secondary';
  more.textContent = 'Show more values';
  content.append(searchField, list, more);

  const step = 80;
  let matches = options;
  let shown = 0;
  function showMore() {
    for (const [value, count] of matches.slice(shown, shown + step)) {
      const option = document.createElement('label');
      const checkbox = document.createElement('input');
      const label = document.createElement('span');
      const tally = document.createElement('span');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(value);
      label.textContent = value || '(Blank)';
      tally.className = 'column-filter-tally';
      tally.textContent = number.format(count);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(value);
        else selected.delete(value);
        apply.disabled = !selected.size;
      });
      option.append(checkbox, label, tally);
      list.append(option);
    }
    shown += step;
    more.hidden = shown >= matches.length;
  }

  function update() {
    const query = searchText(search.value);
    matches = options.filter(([value]) => searchText(value || '(Blank)').includes(query));
    list.replaceChildren();
    list.scrollTop = 0;
    shown = 0;
    if (!matches.length) list.textContent = 'No matching values.';
    showMore();
  }

  search.addEventListener('input', update);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') event.preventDefault();
  });
  more.addEventListener('click', () => {
    const index = shown;
    showMore();
    list.children[index]?.querySelector('input').focus();
  });
  apply.disabled = !selected.size;
  update();
  return { focus: search, read: () => ({ values: [...selected] }) };
}

function matcher(key, filter) {
  if (filter.values) {
    const values = new Set(filter.values);
    return tender => values.has(valueText(tender[key]));
  }
  if (filter.query) {
    const query = searchText(filter.query);
    return filter.mode === 'exact'
      ? tender => searchText(tender[key]) === query
      : tender => searchText(tender[key]).includes(query);
  }
  const from = filter.from ? Date.parse(`${filter.from}T00:00:00+06:00`) : -Infinity;
  const to = filter.to ? Date.parse(`${filter.to}T00:00:00+06:00`) + day : Infinity;
  return tender => {
    const date = Date.parse(tender[key]);
    return date >= from && date < to;
  };
}

function describe(filter) {
  if (filter.values) return filter.values.map(value => value || '(Blank)').join(', ');
  if (filter.query) return `${filter.mode === 'exact' ? 'is' : 'contains'} ${filter.query}`;
  if (filter.from && filter.to) return `${filter.from} to ${filter.to}`;
  return filter.from ? `from ${filter.from}` : `through ${filter.to}`;
}

export function createColumnFilters(onChange) {
  const dialog = document.getElementById('column-filter-dialog');
  const form = document.getElementById('column-filter-form');
  const title = document.getElementById('column-filter-title');
  const content = document.getElementById('column-filter-content');
  const clear = document.getElementById('clear-column-filter');
  const apply = document.getElementById('apply-column-filter');
  const bar = document.getElementById('column-filter-bar');
  const chips = document.getElementById('column-filter-chips');
  const icon = document.getElementById('column-filter-icon');
  const filters = new Map();
  const columns = new Map();
  let tenders = [];
  let editor;

  function matchingRows(exclude) {
    const active = [...filters].filter(([key]) => key !== exclude).map(([key, filter]) => matcher(key, filter));
    return active.length ? tenders.filter(tender => active.every(matches => matches(tender))) : tenders;
  }

  function open(key) {
    const { label, type } = columns.get(key);
    const current = filters.get(key);
    const editors = { text: textEditor, date: dateEditor };
    title.textContent = `Filter by ${label}`;
    content.replaceChildren();
    clear.hidden = !current;
    apply.disabled = false;
    if (type === 'values') {
      const counts = new Map();
      for (const tender of matchingRows(key)) {
        const value = valueText(tender[key]);
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      editor = valuesEditor(current, content, counts, apply);
    } else {
      editor = editors[type](current, content);
    }
    editor.key = key;
    dialog.showModal();
    editor.focus.focus();
  }

  function updateControls() {
    bar.hidden = !filters.size;
    chips.replaceChildren();
    for (const [key, { button, label }] of columns) {
      const filter = filters.get(key);
      button.disabled = !tenders.length;
      button.classList.toggle('is-filtered', Boolean(filter));
      button.setAttribute('aria-label', `Filter by ${label}${filter ? ' (active)' : ''}`);
      if (!filter) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip result-filter-chip';
      chip.textContent = `${label}: ${describe(filter)}`;
      chip.title = chip.textContent;
      chip.setAttribute('aria-haspopup', 'dialog');
      chip.addEventListener('click', () => open(key));
      chips.append(chip);
    }
  }

  for (const header of document.querySelectorAll('th[data-filter]')) {
    const key = header.dataset.filter;
    const label = header.textContent;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'column-filter-button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.append(label, icon.content.cloneNode(true));
    button.addEventListener('click', () => open(key));
    header.replaceChildren(button);
    columns.set(key, { button, label, type: header.dataset.filterType });
  }

  function finish(key) {
    dialog.close();
    updateControls();
    onChange(matchingRows(), filters.size > 0);
    columns.get(key).button.focus();
  }

  document.getElementById('cancel-column-filter').addEventListener('click', () => dialog.close());
  clear.addEventListener('click', () => {
    filters.delete(editor.key);
    finish(editor.key);
  });
  document.getElementById('clear-column-filters').addEventListener('click', () => {
    const key = filters.keys().next().value;
    filters.clear();
    updateControls();
    onChange(tenders, false);
    columns.get(key).button.focus();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const filter = editor.read();
    if (!filter) return;
    filters.set(editor.key, filter);
    finish(editor.key);
  });

  updateControls();
  return {
    setResults(results, reset = false) {
      const needsUpdate = reset || Boolean(results.length) !== Boolean(tenders.length);
      tenders = results;
      if (reset) filters.clear();
      if (needsUpdate) updateControls();
      return matchingRows();
    },
  };
}
