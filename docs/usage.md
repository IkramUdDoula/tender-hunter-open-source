# Using Tender Hunter

## Search for tenders

1. Sign in with the app password if the instance asks for it.
2. Select one or more ministries or choose **All ministries** for a single broad search. Optionally select a procurement nature.
3. Click **Search tenders**. The progress bar shows which ministry is loading. Results appear as each ministry finishes and stay available if another search fails. The browser reuses saved results when the search criteria for a ministry match a confirmed complete search from the past six hours. The footer identifies cached results. **Refresh results** bypasses the cache.
4. Use **Results per page** to show 20, 100, or **All** matching notices. Use **Next** and **Previous** in the paged views. Select **Open** in the URL column to view the official notice. On a narrow screen, scroll the table horizontally for the remaining columns.

Dates and times in the table use Bangladesh time. The search covers live notices. The configured run cap applies to each Apify search. Multiple uncached ministry searches can increase Apify usage.

Searches default to 5,000 notices and 10 minutes per ministry. If a search reaches its time or record limit, or completeness cannot be verified, **Partial results** identifies the affected ministries. Counts cover loaded notices only, so a targeted search may find additional matches. Partial results are not cached. Narrow the search criteria or refresh results to try again.

## Search contract awards

Choose **Contract awards** under **Search for**, choose ministries, and optionally enter a title keyword or **Contract signed since** window such as `30 days` or `2026-01-01`. Select **Search awards**. The procurement-nature filter applies only to live tenders and is replaced by the signing-date filter in award mode. **Manage quick filters** also supports award districts, procurement methods and organization or procuring entity.

Awards show the winner, tender ID, lot ID, district, signing date and rounded value. The list's value is rounded to three decimal places of crore taka; open the official award for the exact contract price and notification date. The signing date is a calendar date, displayed without a time. Non-BDT amounts retain their published text and are excluded from numeric BDT filters.

The title keyword does not search winner names. Use the **Winner** column to select companies among the loaded results and **Value (BDT, rounded)** to filter an inclusive numeric range. A capped or timed-out search is partial, so an absent company is not evidence that it has never won. Filtered award searches scan at most the newest 50,000 source records; narrow by keyword or signing-date window. Changing the record type clears column filters and sorting. Complete award and tender searches are cached separately for six hours.

Star awards to save them. **Saved awards** in the header opens their table; the dialog's **Show saved** selector switches between tenders and awards. Each lot is saved separately, even if the tender ID matches another lot. Existing saved tender notices and quick filters are retained.

## Filter and sort loaded results

Select a column heading to open its filter. Use a text match for ID or title, a date range for publication or closing dates, or a searchable checklist for columns such as organization and method. Checklist counts reflect the other applied column filters across all pages. Multiple values within a column match any selected value. Filters on different columns must all match.

Column filters use the notices already loaded; they do not start a new upstream search. The dialog warns when the underlying search is incomplete.

Select an applied filter above the table to edit or clear it. Select **Clear column filters** to restore the full search results.

Select the sort arrow beside a column filter to sort in ascending order. Select it again for descending order, then a third time to restore the original search order. Sort, filter, and page through loaded results without starting another Apify run.

## Save tenders

Select a notice's star to save its current details. Open **Saved tenders** in the header to see your saved notices in a table, including after reloading the app without a search. Select a filled star to remove a notice.

Saved notices stay in this browser until removed or the site's browser data is cleared. They retain the details from when they were saved, including the status and closing date. Saving a notice and opening the table do not start an Apify search.

## Save a quick filter

Open **Manage quick filters**. Choose one or more ministries and a procurement nature, then optionally add a shortcut name, keyword, organization or procuring entity, procurement method, or publication window. For **Published since**, enter a relative value such as `7 days` or a date such as `2026-11-01`.

Select **Save quick filter**, then **Done**. Selecting the shortcut searches with its saved criteria and uses the browser cache when available. Use **Clear quick filter** to return to the visible dropdown criteria or **Remove** in the popup to delete a shortcut. Shortcuts stay in the browser where they were saved.

## Check usage or troubleshoot

- The **Apify usage** card displays account-wide usage, the spending limit, and the cycle end. **Billing & payments** opens Apify’s own console.
- An Apify error can come from an invalid token, an account limit, or a failed actor run. Check the configured token and the run details in Apify Console.
- If the app restarts or a search expires, run the search again to create a new result set.
- If a local server cannot start because port 3000 is in use, set `PORT` to a free port in `.env` and restart the app.
