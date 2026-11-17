# Deploy Tender Hunter on Railway

## 1. Connect your GitHub fork

Fork the repository on GitHub. In Railway, create a project using **Deploy from GitHub repo** and select your fork. If it does not appear, grant the Railway GitHub app access to the fork. Set the service’s source branch to `main` to deploy future pushes automatically. [Railway quick start](https://docs.railway.com/quick-start)

## 2. Configure service variables

In the app service’s **Variables** tab, add these values and deploy the staged changes. [Railway variables](https://docs.railway.com/variables)

| Variable | Value |
| --- | --- |
| `APIFY_TOKEN` | Your token from [Apify account integrations](https://console.apify.com/settings/integrations). |
| `APP_PASSWORD` | A strong, unique password for signing in to this instance. Required for startup on Railway. |
| `APIFY_MAX_ITEMS` | Optional cap per Apify search. Defaults to `100`. Use `3` for a small smoke test. |

Railway normally detects the Node app and its `npm start` command. The app builds its assets at startup and listens on Railway’s `PORT`. Keep the service at one replica so subsequent pages of a search reach the same in-memory session.

## 3. Open and verify the deployment

Wait for the deployment to succeed. Under **Settings → Networking → Public Networking**, select **Generate Domain**. Open the generated HTTPS URL and sign in with `APP_PASSWORD`. Check the ministry list and usage card, then run a small search. [Railway public networking](https://docs.railway.com/networking/public-networking)

If the deployment crashes, check the service logs and confirm `APP_PASSWORD` is set. If the domain returns a gateway error, check that its target port matches the service’s `PORT`. If a search fails after sign-in, check `APIFY_TOKEN`, account usage limits, and the corresponding Apify run. Existing search sessions expire after a restart. Saved quick filters stay in the browser.
