# Using Tender Hunter

## Search for tenders

1. Sign in with the app password if the instance asks for it.
2. Select a ministry or **All ministries**. Optionally select a procurement nature.
3. Click **Search tenders**. A new search collects results from Apify. Repeating the same criteria in the same browser within six hours uses the saved results. The footer shows when a cached result was saved.
4. Use **Next** and **Previous** to browse 20 notices at a time. Select **Open** in the URL column to view the official notice. On a narrow screen, scroll the table horizontally for the remaining columns.

Dates and times in the table use Bangladesh time. The search covers live notices. If the app reaches the configured run cap, a narrower search can surface more relevant results.

## Filter search results

Select a column heading to open its filter. Use a text match for ID or title, a date range for publication or closing dates, or a searchable checklist for columns such as organization and method. Checklist counts reflect the other applied column filters across all pages. Multiple values within a column match any selected value. Filters on different columns must all match.

Select an applied filter above the table to edit or clear it. Select **Clear column filters** to restore the full search results. Filtering and paging happen in the browser without starting another Apify run.

## Save a quick filter

Open **Manage quick filters**. Choose a ministry and procurement nature, then optionally add a shortcut name, keyword, organization or procuring entity, procurement method, or publication window. For **Published since**, enter a relative value such as `7 days` or a date such as `2026-11-01`.

Select **Save quick filter**, then **Done**. Selecting the shortcut searches with its saved criteria and uses the browser cache when available. Use **Clear quick filter** to return to the visible dropdown criteria or **Remove** in the popup to delete a shortcut. Shortcuts stay in the browser where they were saved.

## Check usage or troubleshoot

- The **Apify usage** card displays account-wide usage, the spending limit, and the cycle end. **Billing & payments** opens Apify’s own console.
- An Apify error can come from an invalid token, an account limit, or a failed actor run. Check the configured token and the run details in Apify Console.
- If the app restarts or a search expires, run the search again to create a new result set.
- If a local server cannot start because port 3000 is in use, set `PORT` to a free port in `.env` and restart the app.
