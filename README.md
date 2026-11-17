# Tender Hunter

Tender Hunter is a self-hosted browser app for finding live Bangladesh e-GP tender notices. It searches the [Bangladesh e-GP actor on Apify](https://apify.com/a-g-d/bd-egp) and links results to their official notices.

- Browse by ministry or across all ministries, with an optional procurement nature.
- Save named quick filters with keywords, organizations, procuring entities, methods, and publication windows.
- View 20 notices per page and track your Apify account usage from the app.

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
| `APIFY_MAX_ITEMS` | Maximum records the actor may collect per search. Defaults to 100. |
| `APP_PASSWORD` | Shared password for app sign-in. Optional on loopback and required on Railway. |
| `PORT` | HTTP port. Defaults to 3000 locally. |

## Deploy on Railway

Connect a fork of this repository to a Railway service and configure `APIFY_TOKEN` and a strong `APP_PASSWORD` in the service variables. Railway supplies `PORT`. Add an HTTPS domain for browser access and use the configured password to sign in.

## Usage and development

See the [usage guide](docs/usage.md) for search, shortcuts, and common errors. The app uses a Node.js HTTP server and browser-native HTML, CSS, and JavaScript. `npm run build` bundles the app into `dist/`. Tender search sessions live in server memory, and saved quick filters live in the browser.

The application code is available under the [MIT License](LICENSE). The tender notices come from [Bangladesh e-GP](https://www.eprocure.gov.bd/). Apify runs are subject to your account’s usage limits and pricing.
