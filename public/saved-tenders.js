import { recordKey, recordType, setTableType } from './records.js';

const storagePrefix = 'tender-hunter.saved-tender:';

function readSavedTenders() {
  const saved = new Map();
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(storagePrefix)) continue;
    const stored = localStorage.getItem(key);
    let entry;
    try {
      entry = JSON.parse(stored);
    } catch {
      continue;
    }
    const id = recordKey(entry?.tender);
    if (id && key === storagePrefix + id && Number.isFinite(entry.savedAt)) saved.set(id, entry);
  }
  return saved;
}

function showFeedback(element, text) {
  element.textContent = text;
  element.hidden = !text;
}

export function createSavedTenders(searchTable, renderRow) {
  const dialog = document.getElementById('saved-tenders-dialog');
  const close = document.getElementById('close-saved-tenders');
  const savedTable = document.getElementById('saved-table');
  const savedRows = document.getElementById('saved-rows');
  const tableRegion = document.getElementById('saved-table-region');
  const empty = document.getElementById('saved-tenders-empty');
  const savedFeedback = document.getElementById('saved-tenders-feedback');
  const searchFeedback = document.getElementById('save-tender-feedback');
  const typePicker = document.getElementById('saved-record-type');
  savedTable.prepend(searchTable.querySelector('colgroup').cloneNode(true), searchTable.tHead.cloneNode(true));

  let saved = new Map();
  let storageAvailable = false;

  function updateType() {
    const award = typePicker.value === 'awards';
    document.getElementById('saved-tenders-title').textContent = award ? 'Saved awards' : 'Saved tenders';
    empty.textContent = award ? 'Star an award to find it here later.' : 'Star a tender to find it here later.';
    setTableType(savedTable, typePicker.value);
  }

  function load() {
    try {
      saved = readSavedTenders();
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  }

  function updateStar(button) {
    const starred = saved.has(button.dataset.tenderId);
    button.setAttribute('aria-pressed', String(starred));
    const award = button.dataset.recordType === 'awards';
    button.title = starred ? `Remove from Saved ${award ? 'awards' : 'tenders'}` : `Save ${award ? 'award' : 'tender'}`;
    button.textContent = starred ? '\u2605' : '\u2606';
  }

  function updateSearchStars() {
    for (const button of searchTable.querySelectorAll('.star-toggle')) updateStar(button);
  }

  function renderSavedRows() {
    const active = document.activeElement;
    const focusedRow = savedRows.contains(active) ? active.closest('tr')?.sectionRowIndex : undefined;
    const entries = [...saved.values()].filter(entry => recordType(entry.tender) === typePicker.value)
      .sort((left, right) => right.savedAt - left.savedAt);
    const fragment = document.createDocumentFragment();
    for (const { tender } of entries) fragment.append(renderRow(tender));
    savedRows.replaceChildren(fragment);
    tableRegion.hidden = !entries.length;
    empty.hidden = !storageAvailable || Boolean(entries.length);
    if (focusedRow !== undefined) {
      const row = savedRows.rows[Math.min(focusedRow, savedRows.rows.length - 1)];
      (row?.querySelector('.star-toggle') ?? close).focus();
    }
  }

  function toggle(tender, button) {
    const id = button.dataset.tenderId;
    const key = storagePrefix + id;
    const feedback = dialog.open ? savedFeedback : searchFeedback;
    try {
      if (button.getAttribute('aria-pressed') === 'true') {
        localStorage.removeItem(key);
        saved.delete(id);
      } else {
        const entry = { tender, savedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(entry));
        saved.set(id, entry);
      }
    } catch {
      showFeedback(feedback, 'Could not update saved items in this browser.');
      return;
    }
    storageAvailable = true;
    showFeedback(feedback, '');
    updateSearchStars();
    if (dialog.open) renderSavedRows();
  }

  function refresh() {
    load();
    updateSearchStars();
    showFeedback(savedFeedback, storageAvailable ? '' : 'Saved items are unavailable in this browser.');
  }

  document.getElementById('open-saved-tenders').addEventListener('click', () => {
    refresh();
    typePicker.value = searchTable.dataset.searchType ?? 'tenders';
    updateType();
    renderSavedRows();
    dialog.showModal();
  });
  typePicker.addEventListener('change', () => { updateType(); renderSavedRows(); });
  close.addEventListener('click', () => dialog.close());
  window.addEventListener('storage', event => {
    if (event.key !== null && !event.key.startsWith(storagePrefix)) return;
    refresh();
    if (dialog.open) renderSavedRows();
  });
  load();

  return {
    setType(type) {
      typePicker.value = type;
      updateType();
    },
    createButton(tender) {
      const id = recordKey(tender);
      if (!id) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'star-toggle';
      button.dataset.tenderId = id;
      button.dataset.recordType = recordType(tender);
      button.setAttribute('aria-label', recordType(tender) === 'awards' ? `Save award ${tender.id}, lot ${tender.lotId}` : `Save tender ${id}`);
      button.addEventListener('click', () => toggle(tender, button));
      updateStar(button);
      return button;
    },
  };
}
