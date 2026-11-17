# Using Tender Hunter

## Search for tenders

1. Sign in with the app password if the instance asks for it.
2. Select a ministry or **All ministries**. Optionally select a procurement nature.
3. Click **Search tenders**. The first 20 records load after Apify finishes its run.
4. Use **Next** and **Previous** to browse the same result set. Select **Open** in the URL column to view the official notice. On a narrow screen, scroll the table horizontally for the remaining columns.

Dates and times in the table use Bangladesh time. The search covers live notices. If the app reaches the configured run cap, a narrower search can surface more relevant results.

## Save a quick filter

Open **Manage quick filters**. Choose a ministry and procurement nature, then optionally add a shortcut name, keyword, organization or procuring entity, procurement method, or publication window. For **Published since**, enter a relative value such as `7 days` or a date such as `2026-11-01`.

Select **Save quick filter**, then **Done**. Selecting the shortcut applies the saved criteria and immediately starts an Apify search. Use **Clear quick filter** to return to the visible dropdown criteria or **Remove** in the popup to delete a shortcut. Shortcuts stay in the browser where they were saved.

## Check usage or troubleshoot

- The **Apify usage** card displays account-wide usage, the spending limit, and the cycle end. **Billing & payments** opens Apify’s own console.
- An Apify error can come from an invalid token, an account limit, or a failed actor run. Check the configured token and the run details in Apify Console.
- If the app restarts or a search expires, run the search again to create a new result set.
- If a local server cannot start because port 3000 is in use, set `PORT` to a free port in `.env` and restart the app.
