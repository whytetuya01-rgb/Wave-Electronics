# Deploying to Vercel

## Layout

One Vercel project, two services, defined in [`vercel.json`](vercel.json):

| Service | Folder | Serves |
|---|---|---|
| `server` | `server/` | The Express API, as one Vercel Function. Every `/api/*` path. |
| `client` | `client/` | The Vite build. Every other path; unknown paths return `index.html` so page refreshes and deep links work. |

- Both are public on the same domain. The browser calls the API at the relative path `/api`, so no `VITE_API_URL` and no service bindings are needed.
- Node.js 22 (pinned by `engines` in each `package.json`).
- On Vercel the API does not listen on a port. It connects to MongoDB on the first request; if the database is unreachable it answers `503` and the next request retries.
- Dependencies install from the root `package-lock.json` (npm workspaces). Add packages from the repo root, e.g. `npm install <pkg> -w client`, so that lockfile stays complete.

## One-time project setup

1. In Vercel, **Add New → Project** and import the GitHub repository.
2. Leave **Root Directory** at the repository root (where `vercel.json` is). Don't set build, output or install commands in the dashboard; they come from `vercel.json` and each service's framework.
3. Add the environment variables below **before** the first deployment. Without them every API request fails.
4. Pushes to the production branch (`main`) deploy to Production; pushes to any other branch create a Preview deployment.

## Environment variables

Set them in **Project → Settings → Environment Variables**, mark each one **Sensitive**, and scope it to the right environment. Never put real values in the repository, in `.env.example`, or in tickets and chat.

| Variable | Production | Preview |
|---|---|---|
| `MONGODB_URI` | Production database, with a user that has `readWrite` on that database only. | A **separate** database and user (e.g. `wave_electronics_preview`). Preview testing creates jobs, issues stock and records receipts, so it must never point at production data. |
| `JWT_SECRET` | Unique; generate with `openssl rand -hex 32`. | A different value, so a token issued by a Preview can't be used against Production. |
| `CORS_ORIGIN` | `https://<your production domain>`; comma-separate several (e.g. a custom domain and `<project>.vercel.app`). | The branch URL, `https://<project>-git-<branch>-<team>.vercel.app`. |
| `COMPANY_ADDRESS`, `COMPANY_GSTIN` | Optional, printed on PDFs. | Optional. |

- Don't set `NODE_ENV` or `PORT`. Vercel runs with `NODE_ENV=production`, which turns on the start-up checks: a missing or short (< 32 characters) `JWT_SECRET`, a missing `MONGODB_URI` or `CORS_ORIGIN`, or a database that isn't a replica set all stop the API.
- `CORS_ORIGIN` decides which *other* websites may call the API from a browser. The app itself calls the API on its own domain, which needs no CORS header, so a Preview URL that isn't listed still works. Keep the list to your own domains; wildcards are rejected.
- Changed variables apply from the next deployment; redeploy after editing them.

## MongoDB Atlas

- The database must be a replica set (every Atlas cluster is): stock reservation, material issue and receipts run in multi-document transactions.
- Use one database user per environment with the built-in role `readWrite` on that environment's database only, never `atlasAdmin` or `readWriteAnyDatabase`, and a long generated password. Rotate it if it is ever exposed.
- **Initial testing:** Vercel Functions have no fixed outbound IP addresses, so Atlas **Network Access** needs `0.0.0.0/0`. That is only acceptable together with the strong, least-privilege users above.
- **Production (recommended):** give the API fixed outbound addresses and allow only those in Atlas, then remove `0.0.0.0/0`. Vercel offers this as Static IPs and, on Enterprise, Secure Compute (dedicated IPs plus private VPC peering with the Atlas cluster). Check which one your plan includes.
- Turn on Atlas backups and alerts for the production cluster.

## PDF logo

Commit the company logo as `server/assets/company-logo.png` (PNG or JPEG, roughly square). Vercel bundles it into the API function and it's printed on Delivery Challan and Job Receipt PDFs. See [`server/assets/README.md`](server/assets/README.md).

## Login rate limiting (required before production)

The login limiter (20 attempts per 15 minutes per IP, [`server/src/middleware/rateLimit.ts`](server/src/middleware/rateLimit.ts)) keeps its counts in memory. On Vercel each function instance counts separately and instances are recycled, so the limit is weaker than it looks. That's fine for Preview testing. **Before production, move it to a shared store:** `express-rate-limit` takes a `store` option, e.g. Redis (`rate-limit-redis` with a Redis database from the Vercel Marketplace) or MongoDB (`rate-limit-mongo`, reusing Atlas).

## Preview checklist

- [ ] `/api/health` shows `"connected": true` and `"isReplicaSet": true`.
- [ ] Function logs show `[MongoDB Mode]: Replica Set ... ACID Transactions Active` and no errors.
- [ ] Log in; a wrong password returns an error; the 21st attempt in 15 minutes is refused.
- [ ] Dashboard, Components, Vendors load; refreshing a deep link such as `/jobs` reloads the page.
- [ ] Stock inward: create an entry; stock increases.
- [ ] Job: create, approve (reserves stock), issue material (challan), record a receipt; stock and ledger agree.
- [ ] Delivery Challan and Job Receipt PDFs download, with the logo.

Preview deployments are behind Vercel Authentication by default (only team members can open them). For automated tests, use **Protection Bypass for Automation** and keep its secret out of the repository.

## Local development

Unchanged: `npm run dev:server` and `npm run dev:client`. To run the Vercel setup locally, `vercel login`, `vercel link`, then `vercel dev`.
