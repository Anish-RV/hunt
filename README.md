# The Great Bi-Annual SF Scavenger Hunt

This website is deployed via a combination of Cloudflare Workers and GitHub Pages.

- **Frontend** (`src/`): a React app hosted on GitHub Pages at sanfranciscohunt.com. Visitors enter a password, and the app sends it to the worker.
- **Worker** (`worker/`): a Cloudflare Worker that checks the password, then reads the leaderboard, tracker, and photo challenge tabs from a private Google Sheet using a Google service account. It also serves resized previews of the photo challenge uploads from Google Drive.

The frontend never holds any secrets; they live only in Cloudflare.

For how the hunt itself is run and scored (clues, check-ins, chill/competitive mode, the tracker and photo feed) and the hunt-day checklist, see [docs/how-the-hunt-works.md](docs/how-the-hunt-works.md).

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

To work on styling without the password or real data, use made-up teams, positions, and photos (from `src/fakeLeaderboard.js`):

```sh
REACT_APP_FAKE_LEADERBOARD=1 npm start
```

### Worker changes

Run the worker and the frontend in separate terminals:

```sh
# Terminal 1: serves your local worker.js on http://localhost:8787
cd worker
npx wrangler dev --remote

# Terminal 2: point the frontend at the local worker
REACT_APP_WORKER_URL=http://localhost:8787 npm start
```

`--remote` runs your local code on Cloudflare's preview environment using the secrets already stored in Cloudflare, so you don't need any secrets on your machine. The worker reloads when you save. Restart it after changing a secret. Photos load on the laptop only, since their links point at `localhost:8787`.

The worker's tracker and photo logic has tests:

```sh
node --test worker/tracker.test.js worker/photos.test.js
```

To run fully offline with plain `npx wrangler dev`, put the secrets in `worker/.dev.vars` (one `NAME=value` per line). This file is gitignored; never commit it.

## Secrets

Stored as Cloudflare Worker secrets (see the comment at the top of `worker/worker.js` for details):

| Name | What it is |
|---|---|
| `SITE_PASSWORD` | The password visitors enter |
| `GOOGLE_CLIENT_EMAIL` | Google service account email |
| `GOOGLE_PRIVATE_KEY` | Google service account private key (PEM) |
| `SHEET_ID` | ID of the leaderboard Google Sheet |
| `PHOTO_SIGNING_SECRET` | Random value that encrypts photo links. To set it, run `openssl rand -hex 32 \| npx wrangler secret put PHOTO_SIGNING_SECRET`. Changing it only breaks links visitors already have loaded, which refresh within a minute. |

The sheet and the photo uploads folder must be shared with the service account's email (sf-scav-hunt@sf-scav-hunt.iam.gserviceaccount.com), and the `sf-scav-hunt` Google Cloud project needs the Sheets and Drive APIs enabled. Non-secret settings (`ALLOWED_ORIGIN` and the tab ranges) are in `worker/wrangler.toml`.

```sh
npx wrangler secret list              # names only; values can't be read back
npx wrangler secret put SITE_PASSWORD # set or change a secret (takes effect immediately)
```

## Deploying

Deploy the worker first when a change touches both, so the live site never calls a worker that's missing something.

Worker (from the `worker/` directory):

```sh
npx wrangler deploy
```

Make sure your local worker code is up to date with what's deployed before deploying, since this overwrites the live worker.

UI (make sure `REACT_APP_FAKE_LEADERBOARD` and `REACT_APP_WORKER_URL` aren't set in your shell, or they get built into the live site):

```sh
npm run build
npm run deploy
```

## Logs

```sh
cd worker
npx wrangler tail     # stream live logs from the deployed worker
```

Past logs are in the Cloudflare dashboard under Workers & Pages → `sf-scav-hunt-leaderboard-proxy` → Logs.
