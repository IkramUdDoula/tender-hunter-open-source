import { mkdir, readFile, writeFile } from 'node:fs/promises';

const assets = {};
const files = {
  '/': ['index.html', 'text/html'],
  '/style.css': ['style.css', 'text/css'],
  '/app.js': ['app.js', 'text/javascript'],
  '/column-filters.js': ['column-filters.js', 'text/javascript'],
  '/saved-tenders.js': ['saved-tenders.js', 'text/javascript'],
  '/search-cache.js': ['search-cache.js', 'text/javascript'],
  '/search-status.js': ['search-status.js', 'text/javascript'],
  '/records.js': ['records.js', 'text/javascript'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
};

for (const [route, [file, type]] of Object.entries(files)) {
  assets[route] = { body: await readFile(new URL(`public/${file}`, import.meta.url), 'utf8'), type };
}

const worker = await readFile(new URL('worker.mjs', import.meta.url), 'utf8');
const catalog = JSON.parse(await readFile(new URL('catalog.json', import.meta.url), 'utf8'));
const output = new URL('dist/server/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('index.js', output), `const assets = ${JSON.stringify(assets)};\nconst catalog = ${JSON.stringify(catalog)};\n${worker}`);
