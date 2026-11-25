const calendarFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
const moneyFormat = new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 });

export const recordType = record => record?.recordType === 'award' ? 'awards' : 'tenders';

export function recordKey(record) {
  const id = String(record?.id ?? '').trim();
  if (!id) return '';
  if (recordType(record) === 'tenders') return id;
  const lot = String(record.lotId ?? '').trim();
  return lot ? `award:${id}:${lot}` : '';
}

export function setTableType(table, type) {
  for (const element of table.querySelectorAll('[data-record-type]')) {
    element.hidden = element.dataset.recordType !== type;
  }
}

export function formatCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '-';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? '-' : calendarFormat.format(date);
}

export function formatContractValue(record) {
  return typeof record.contractValueBdt === 'number' && Number.isFinite(record.contractValueBdt)
    ? `৳${moneyFormat.format(record.contractValueBdt)}` : record.contractValueText || '-';
}
