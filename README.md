# Tender Hunter

Tender Hunter is a self-hosted browser app for finding live Bangladesh e-GP tender notices and awarded contracts. It searches the [Bangladesh e-GP actor on Apify](https://apify.com/a-g-d/bd-egp) and links results to their official notices and awards.

- Select one or more ministries or search across all ministries, with an optional procurement nature. Results appear as each search finishes.
- Save named quick filters with keywords, organizations, procuring entities, methods, and publication windows.
- Filter and sort loaded results using the column controls. Confirmed complete searches are reused in the same browser for six hours; **Refresh results** starts a fresh search.
- Show 20, 100, or all matching notices and track your Apify account usage from the app.
- Star notices and reopen them in the Saved tenders table whenever you return in the same browser.
- Switch to **Contract awards** to see winners, lot IDs, signing dates and rounded contract values. Filter by title, signing-date window and district, or filter loaded results by winner and BDT value range. Tender and award results use separate cache keys; saved awards are identified by tender and lot.

Award-list values are rounded to three decimal places of crore taka. Open the official award page for the exact price and Notification of Award date. Signing dates are calendar dates and are displayed without a timezone shift. Company names are filtered within loaded results; the upstream keyword filter searches titles. Filtered award searches can scan at most the newest 50,000 source records, so use keywords and signing-date windows for focused searches.

Sign-in lasts for 30 days in the same browser, unless you sign out, clear cookies, or the app password changes.

## Quick start

You need Node.js 22 or later and an Apify account with an API token. There are no package dependencies to install.

```sh
git clone https://github.com/IkramUdDoula/tender-hunter-open-source.git
cd tender-hunter-open-source
```

Copy `.env.example` to `.env` and set `APIFY_TOKEN` to a token from [Apify account integrations](https://console.apify.com/settings/integrations). Start the app with `npm start` and open [localhost:3000](http://127.0.0.1:3000).

| Variable | Purpose |
| --- | --- |
| `APIFY_TOKEN` | Required for tender searches and usage reporting. Keep it on the server. |
| `APIFY_MAX_ITEMS` | Maximum records the actor may collect per search (1–50,000). Defaults to 5,000. |
| `APIFY_TIMEOUT_SECONDS` | Actor runtime budget per search (60–3,600 seconds). Defaults to 600 seconds. |
| `APP_PASSWORD` | Shared password for app sign-in. Optional on loopback and required on Railway. |
| `PORT` | HTTP port. Defaults to 3000 locally. |

## Deployment guides

- [Deploy with an AI agent](AGENTS.md) covers a copyable prompt, setup, verification, and optional Apify MCP access.
- [Run locally](docs/deploy-local.md) covers setup on Windows, macOS, and Linux, optional sign-in, and a first search.
- [Deploy on Railway](docs/deploy-railway.md) covers GitHub autodeploys, service variables, HTTPS, and troubleshooting.

## Usage and development

The app checks the actor's completion log because an actor can succeed after stopping early. Searches stopped by a time or record limit, or whose completeness cannot be verified, show **Partial results**. Their counts cover loaded notices only, and partial results are not cached. Only an `end_of_list` completion is treated as complete. Existing environment overrides still apply, and larger search budgets can increase Apify charges.

See the [usage guide](docs/usage.md) for search, shortcuts, and common errors. The app uses a Node.js HTTP server and browser-native HTML, CSS, and JavaScript. `npm run build` bundles the app into `dist/`. Active Apify runs are tracked in server memory. Completed results and saved quick filters live in the browser.

Run `npm test` for the API and cache regression checks. `node tests/preview.mjs` starts a loopback-only browser QA server with synthetic data and prints its temporary URL; it never calls Apify.

The application code is available under the [MIT License](LICENSE). The tender notices come from [Bangladesh e-GP](https://www.eprocure.gov.bd/). Apify runs are subject to your account’s usage limits and pricing.
