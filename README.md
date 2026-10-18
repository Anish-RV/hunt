# The Great Bi-Annual SF Scavenger Hunt

This website is deployed via a combination of Cloudflare Workers and GitHub Pages.

- **Frontend** (`src/`): a React app hosted on GitHub Pages at sanfranciscohunt.com. Visitors enter a password, and the app sends it to the worker.
- **Worker** (`worker/`): a Cloudflare Worker that checks the password, then reads the leaderboard from a private Google Sheet using a Google service account and returns the rows.

The frontend never holds any secrets; they live only in Cloudflare.

## Getting access

To deploy the worker or manage its secrets, you need to be a member of the Cloudflare account that hosts it. Ask an existing maintainer to invite you (Manage Account → Members). Then:

```sh
cd worker
npx wrangler login
npx wrangler whoami       # should list the hunt's Cloudflare account
```

## Running locally

Install dependencies first:

```sh
npm install
```

The local frontend must run on port 3000, since that's the only local origin the worker allows (`ALLOWED_ORIGIN` in `worker/wrangler.toml`).

### UI changes only

```sh
npm start
```

This opens http://localhost:3000 and talks to the **deployed** worker, so you'll need the real site password. No Cloudflare access is needed.

### Worker changes

Run the worker and the frontend in separate terminals:

```sh
# Terminal 1: serves your local worker.js on http://localhost:8787
cd worker
npx wrangler dev --remote

# Terminal 2: point the frontend at the local worker
REACT_APP_WORKER_URL=http://localhost:8787 npm start
```

`--remote` runs your local code on Cloudflare's preview environment using the secrets already stored in Cloudflare, so you don't need any secrets on your machine. The worker reloads when you save `worker.js`.

To run fully offline with plain `npx wrangler dev`, put the secrets in `worker/.dev.vars` (one `NAME=value` per line). This file is gitignored; never commit it.

## Secrets

Stored as Cloudflare Worker secrets (see the comment at the top of `worker/worker.js` for details):

| Name | What it is |
|---|---|
| `SITE_PASSWORD` | The password visitors enter |
| `GOOGLE_CLIENT_EMAIL` | Google service account email |
| `GOOGLE_PRIVATE_KEY` | Google service account private key (PEM) |
| `SHEET_ID` | ID of the leaderboard Google Sheet |

The sheet must be shared with the service account's email. Non-secret settings (`ALLOWED_ORIGIN`, `SHEET_RANGE`) are in `worker/wrangler.toml`.

```sh
npx wrangler secret list              # names only; values can't be read back
npx wrangler secret put SITE_PASSWORD # set or change a secret (takes effect immediately)
```

## Deploying

UI:

```sh
npm run build
npm run deploy
```

Worker (from the `worker/` directory):

```sh
npx wrangler deploy
```

Make sure your local `worker.js` is up to date with what's deployed before deploying, since this overwrites the live worker.

## Logs

```sh
cd worker
npx wrangler tail     # stream live logs from the deployed worker
```

Past logs are in the Cloudflare dashboard under Workers & Pages → `sf-scav-hunt-leaderboard-proxy` → Logs.
