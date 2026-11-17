# Run Tender Hunter locally

## 1. Get the source

Install Git and Node.js 22 or later. No package installation or database is required. Get an API token from [Apify account integrations](https://console.apify.com/settings/integrations).

```sh
git clone https://github.com/IkramUdDoula/tender-hunter-open-source.git
cd tender-hunter-open-source
```

## 2. Configure the app

Copy `.env.example` to `.env`. On Windows PowerShell, run `Copy-Item .env.example .env`. On macOS or Linux, run `cp .env.example .env`.

Open `.env` and fill in `APIFY_TOKEN`. Set `APP_PASSWORD` if you want a local sign-in page. For a small first search, set `APIFY_MAX_ITEMS=3`. The default cap is 100 records per search. Apify may charge for records collected by the actor.

## 3. Start and verify

```sh
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Sign in if you set an app password. Check that the ministry list and Apify usage card load, then choose a ministry and run a search. See the [usage guide](usage.md) for saved quick filters and paging.

Press **Ctrl+C** in the terminal to stop the server. Restart it after editing `.env`. If port 3000 is busy, add `PORT=3001` to `.env` and open the address on that port. The local server listens on loopback.
