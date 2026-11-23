# Deploy Tender Hunter with an AI agent

Copy this prompt to an agent with GitHub access and an authenticated Railway connection.

> Deploy https://github.com/IkramUdDoula/tender-hunter-open-source to my Railway account. Follow its AGENTS.md, tell me which secrets to set in Railway, and verify the deployment. Set up Apify MCP for your client if supported.

## Deployment steps for the agent

1. Clone the repository and read [README.md](README.md). Use Node.js 22 or later and run `npm run build`. There are no package dependencies. Follow [the local guide](docs/deploy-local.md) for a local-only request.
2. Reuse the user's Railway service if specified. For a fresh deployment, fork this repository into the user's GitHub account (or reuse their fork) and use it as the Railway service's GitHub source. Select `main`, keep one replica, and use `npm start`. The server builds the assets at startup and binds to Railway's injected `PORT`. See [the Railway walkthrough](docs/deploy-railway.md).
3. Have the user set `APIFY_TOKEN` from [Apify account integrations](https://console.apify.com/settings/integrations) and a strong, unique `APP_PASSWORD` in Railway service variables. Use an authorized secret store if available. Keep secret values out of prompts, logs, commands, and Git. `APIFY_MAX_ITEMS` is optional and defaults to 5,000. `APIFY_TIMEOUT_SECONDS` defaults to 600 seconds. Existing environment overrides still apply after upgrading. Use a low item limit for a fresh test service if the user wants a small, potentially billable smoke test; capped results are labelled partial and are not cached.
4. Apply the Railway deployment and wait for it to succeed. Generate a Railway HTTPS domain if needed. Check that `/login` loads, then verify that signed-in users can load the ministry catalog and run a small search if credentials and approval for an Apify run are available. Test a column filter and repeat the search once to confirm the browser cache is used.
5. Return the deployed URL, the commit or deployment ID, and the checks you completed. If any account connection or secret setup requires the user's action, tell them exactly where to finish it and continue with any independent checks.

## Apify MCP for the agent

The deployed app uses the Apify REST API with its own server-side `APIFY_TOKEN`. The optional MCP connection lets the agent inspect the [`a-g-d/bd-egp` Actor](https://apify.com/a-g-d/bd-egp), read its input schema, and run it directly when authorized.

1. Add `https://mcp.apify.com` as a streamable HTTP MCP server in your client and authorize the user's Apify account with OAuth. In Codex CLI, run:

   ```sh
   codex mcp add apify --url https://mcp.apify.com
   codex mcp login apify
   codex mcp list
   ```

   For another client, use the [Apify MCP setup guide](https://docs.apify.com/mcp). When the client supports bearer-token authentication, reference a securely injected token through the `Authorization` header.
2. Ask the agent to fetch the Actor details for `a-g-d/bd-egp` and confirm the input schema. If authorized to run a smoke test, request `recordType: "tenders"` and an Actor input cap of `maxItems: 3`, then inspect the returned dataset. Actor runs can incur Apify charges.
