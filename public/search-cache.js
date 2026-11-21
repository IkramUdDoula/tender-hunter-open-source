const lifetime = 6 * 60 * 60 * 1000;
const storeName = 'results';
let database;

function openCache() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('tender-hunter.search-cache', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName).createIndex('expiresAt', 'expiresAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Search cache is blocked.'));
  }).catch(error => {
    database = undefined;
    throw error;
  });
  return database;
}

async function read(key) {
  try {
    const db = await openCache();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(storeName).objectStore(storeName).get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result;
        resolve(entry?.expiresAt > Date.now() ? entry : undefined);
      };
    });
  } catch {
    return undefined;
  }
}

async function write(key, results) {
  try {
    const db = await openCache();
    await new Promise((resolve, reject) => {
      const now = Date.now();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      const expired = store.index('expiresAt').openCursor(IDBKeyRange.upperBound(now));
      expired.onsuccess = () => {
        const cursor = expired.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
      store.put({ expiresAt: now + lifetime, results }, key);
    });
  } catch {
    // Searching still works when storage is disabled or full.
  }
}

export async function cachedSearch(query, fetchResults) {
  const key = new URLSearchParams(query);
  key.sort();
  const search = async () => {
    const cached = await read(key.toString());
    if (cached) return { results: cached.results, cachedAt: cached.expiresAt - lifetime };
    const results = await fetchResults();
    await write(key.toString(), results);
    return { results };
  };
  // Recheck inside the lock so simultaneous searches in two tabs can share a result.
  return navigator.locks
    ? navigator.locks.request(`tender-hunter.search:${key}`, search)
    : search();
}
