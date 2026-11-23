const api = 'https://api.apify.com/v2';
const pageSize = 20;
const batchSize = 500;
const tenderFields = 'tenderId,title,procurementNatureLabel,procurementNature,methodLabel,ministry,organization,procuringEntity,publishedAt,closingAt,status,detailUrl';
const searchLifetime = 60 * 60 * 1000;
const searches = new Map();
const procurementNatures = new Set(['goods', 'works', 'services', 'physicalServices']);
const procurementMethods = ['RFQ', 'OTM', 'LTM', 'TSTM', 'QCBS', 'LCS', 'SFB', 'DC', 'SBCQ', 'SSS', 'IC', 'CSO', 'DPM', 'OSTETM', 'RFQU', 'RFQL'];
const ministryById = new Map(catalog.ministry.map(entry => [entry.id, entry.name]));
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; object-src 'none'; base-uri 'none'",
};

class RequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function maxItems(value) {
  const number = Number(value ?? 5000);
  return Number.isInteger(number) && number >= 1 && number <= 50000 ? number : 5000;
}

function runTimeout(value) {
  const number = Number(value ?? 600);
  return Number.isInteger(number) && number >= 60 && number <= 3600 ? number : 600;
}

function normalize(name = '') {
  return String(name ?? '').normalize('NFKC').toLowerCase().replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

async function callApify(token, endpoint, { query, input, text = false } = {}) {
  const url = new URL(api + endpoint);
  url.search = new URLSearchParams(query);
  const headers = { Authorization: `Bearer ${token}` };
  if (input) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method: input ? 'POST' : 'GET',
    headers,
    body: input ? JSON.stringify(input) : undefined,
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new RequestError(`Apify returned HTTP ${response.status}. Check your Apify account or try again.`, 502);
  return { data: text ? await response.text() : await response.json(), headers: response.headers };
}

async function startSearch(token, query, limit, timeoutSeconds) {
  const ministryId = query.get('ministry');
  const ministry = ministryById.get(ministryId);
  if (ministryId !== 'all' && !ministry) throw new RequestError('Choose a ministry or All ministries.', 400);
  const procurementNature = query.get('procurementNature');
  if (procurementNature && !procurementNatures.has(procurementNature)) {
    throw new RequestError('Choose a valid procurement nature.', 400);
  }
  const input = { recordType: 'tenders', maxItems: limit };
  if (ministry) input.ministry = ministry;
  if (procurementNature) input.procurementNature = procurementNature;
  const method = query.get('method');
  if (method && !procurementMethods.includes(method)) throw new RequestError('Choose a valid procurement method.', 400);
  if (method) input.method = method;

  for (const [field, maxLength] of [['keyword', 200], ['organization', 200], ['publishedSince', 80]]) {
    const value = query.get(field)?.trim();
    if (value && value.length > maxLength) throw new RequestError(`The ${field} filter is too long.`, 400);
    if (value) input[field] = value;
  }
  const { data } = await callApify(token, '/acts/a-g-d~bd-egp/runs', { query: { timeout: timeoutSeconds }, input });
  if (!data.data?.id) throw new RequestError('Apify did not return a tender search ID.', 502);

  for (const [id, search] of searches) {
    if (Date.now() >= search.expiresAt) searches.delete(id);
  }
  const searchId = crypto.randomUUID();
  searches.set(searchId, { runId: data.data.id, limit, ministry, expiresAt: Date.now() + timeoutSeconds * 1000 + searchLifetime });
  return { searchId, timeoutSeconds };
}

async function completionCounts(token, runId) {
  try {
    // This actor can exit SUCCEEDED after a partial scan. Its final log entry
    // contains the actual stop reason; do not infer completeness from status.
    const { data } = await callApify(token, `/logs/${encodeURIComponent(runId)}`, { text: true });
    const summary = [...data.matchAll(/\bRun finished (\{[^\r\n]*\})/g)].at(-1);
    const counts = summary && JSON.parse(summary[1]).counts;
    if (Number.isSafeInteger(counts?.items) && counts.items >= 0 && counts.invalid === 0
      && typeof counts.stopReason === 'string') return counts;
  } catch {
    // Keep retrieved notices usable, but never label unverified data complete.
  }
  return null;
}

async function datasetItems(token, datasetId, query) {
  const { data, headers } = await callApify(token, `/datasets/${encodeURIComponent(datasetId)}/items`, { query });
  if (!Array.isArray(data)) throw new RequestError('Apify returned an unexpected dataset response.', 502);
  const count = headers.get('X-Apify-Pagination-Total');
  const total = Number(count);
  if (count === null || !Number.isSafeInteger(total) || total < 0) {
    throw new RequestError('Apify returned an invalid tender count.', 502);
  }
  return { items: data, total };
}

async function prepareDataset(token, search) {
  const { data } = await callApify(token, `/actor-runs/${encodeURIComponent(search.runId)}`);
  const run = data.data;
  if (['READY', 'RUNNING', 'TIMING-OUT', 'ABORTING'].includes(run?.status)) return false;
  if (run?.status !== 'SUCCEEDED' || !run.defaultDatasetId) {
    throw new RequestError(`The Apify tender run ended with status ${run?.status ?? 'unknown'}. Start a new search to retry.`, 502);
  }

  // The actor matches substrings. Use the ministry field to count exact matches before paging notices.
  const [{ items, total }, counts] = await Promise.all([
    datasetItems(token, run.defaultDatasetId, {
      fields: 'tenderId,ministry', limit: search.ministry ? search.limit : 1,
    }),
    completionCounts(token, search.runId),
  ]);
  // Dataset rows and pagination metadata may become visible at different times
  // immediately after SUCCEEDED. Poll this same run until they agree.
  if (items.length !== Math.min(total, search.ministry ? search.limit : 1)) return false;
  if (search.ministry) {
    const ministry = normalize(search.ministry);
    search.positions = [];
    for (const [index, item] of items.entries()) {
      if (normalize(item.ministry) === ministry) search.positions.push(index);
    }
  }
  const verified = counts?.items === total;
  const complete = verified && counts.stopReason === 'end_of_list' && total <= search.limit;
  const capped = !complete && (total >= search.limit || (verified && counts.stopReason === 'max_items'));
  search.completion = {
    complete,
    stopReason: complete ? 'end_of_list' : capped ? 'max_items' : verified && counts.stopReason === 'run_timeout' ? 'run_timeout' : 'unknown',
    cappedAt: capped ? search.limit : null,
  };
  search.rawTotal = total;
  search.datasetId = run.defaultDatasetId;
  return true;
}

async function readFilteredPage(token, datasetId, positions, size) {
  const ranges = [];
  for (const position of positions) {
    const range = ranges.at(-1);
    if (range && position - range.offset < size) range.positions.push(position);
    else ranges.push({ offset: position, positions: [position] });
  }

  const notices = [];
  for (let start = 0; start < ranges.length; start += 4) {
    const pages = await Promise.all(ranges.slice(start, start + 4).map(async ({ offset, positions }) => {
      const { items } = await datasetItems(token, datasetId, { offset, limit: positions.at(-1) - offset + 1, fields: tenderFields });
      return positions.map(position => items[position - offset]);
    }));
    notices.push(...pages.flat());
  }
  return notices;
}

function mapTender(item) {
  return {
    id: item.tenderId,
    title: item.title,
    nature: item.procurementNatureLabel ?? item.procurementNature,
    methodLabel: item.methodLabel,
    ministry: item.ministry,
    organization: item.organization,
    procuringEntity: item.procuringEntity,
    publishedAt: item.publishedAt,
    closingAt: item.closingAt,
    status: item.status,
    url: item.detailUrl,
  };
}

async function getPage(token, searchId, page, size) {
  const search = searches.get(searchId);
  if (!search || Date.now() >= search.expiresAt) {
    searches.delete(searchId);
    throw new RequestError('This search expired. Search again to load new results.', 404);
  }
  if (!Number.isSafeInteger(page) || page < 1 || page > Math.ceil(search.limit / size)) {
    throw new RequestError('Invalid page number.', 400);
  }
  if (!search.datasetId && !await prepareDataset(token, search)) return null;

  const offset = (page - 1) * size;
  if (!search.ministry) {
    const limit = Math.min(size, search.limit - offset);
    const { items, total } = await datasetItems(token, search.datasetId, { offset, limit, fields: tenderFields });
    return {
      tenders: items.map(mapTender),
      page,
      total: Math.min(total, search.limit),
      ...search.completion,
    };
  }

  const items = await readFilteredPage(token, search.datasetId, search.positions.slice(offset, offset + size), size);
  return {
    tenders: items.map(mapTender),
    page,
    total: search.positions.length,
    ...search.completion,
  };
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: { ...securityHeaders, 'Cache-Control': 'no-store' } });
}

async function usageResponse(token) {
  if (!token) return json({ error: 'Apify usage is unavailable.' }, 503);

  try {
    const { data: response } = await callApify(token, '/users/me/limits');
    const { current, limits, monthlyUsageCycle } = response.data;
    const usedUsd = current.monthlyUsageUsd;
    const limitUsd = limits.maxMonthlyUsageUsd;
    if (!Number.isFinite(usedUsd)) throw new Error('Missing monthly Apify usage.');
    return json({
      usedUsd,
      limitUsd: Number.isFinite(limitUsd) ? limitUsd : null,
      cycleEndsAt: monthlyUsageCycle?.endAt ?? null,
    });
  } catch {
    return json({ error: 'Apify usage is unavailable.' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname === '/api/catalog' && request.method === 'GET') return json({ catalog, procurementMethods, loginEnabled: Boolean(env.APP_PASSWORD) });
    if (pathname === '/api/usage' && request.method === 'GET') return usageResponse(env.APIFY_TOKEN);

    const searchId = /^\/api\/tenders\/([0-9a-f-]{36})$/.exec(pathname)?.[1];
    if (pathname === '/api/tenders' || searchId) {
      const expected = searchId ? 'GET' : 'POST';
      if (request.method !== expected) return json({ error: `Use ${expected} for this request.` }, 405);
      if (!searchId && request.headers.get('X-Tender-Hunter') !== 'search') return json({ error: 'Invalid request.' }, 403);
      if (!env.APIFY_TOKEN) return json({ error: 'Set APIFY_TOKEN on the server to search tenders.' }, 503);
      try {
        if (!searchId) return json(await startSearch(env.APIFY_TOKEN, searchParams, maxItems(env.APIFY_MAX_ITEMS), runTimeout(env.APIFY_TIMEOUT_SECONDS)), 202);
        const size = searchParams.get('view') === 'batch' ? batchSize : pageSize;
        const page = await getPage(env.APIFY_TOKEN, searchId, Number(searchParams.get('page') ?? 1), size);
        return page ? json(page) : json({ status: 'loading' }, 202);
      } catch (error) {
        if (error instanceof RequestError) return json({ error: error.message }, error.status);
        return json({ error: 'Could not load tenders from Apify. Try again in a moment.' }, 502);
      }
    }

    if (request.method !== 'GET' || !Object.hasOwn(assets, pathname)) return new Response('Not found', { status: 404 });
    const asset = assets[pathname];
    return new Response(asset.body, { headers: { ...securityHeaders, 'Content-Type': `${asset.type}; charset=utf-8` } });
  },
};
