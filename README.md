# Wave Electronics

Component Stock & Job Management System (Node/Express/Mongoose backend, React/TypeScript/Vite frontend).

Deploying to Vercel: see [DEPLOYMENT.md](DEPLOYMENT.md).

## Environment Variables

Copy the example files and fill in real values before running either app:

```
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### Server (`server/.env`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Defaults to `5000`. |
| `NODE_ENV` | No | `development` \| `production` \| `test`. Gates the production checks below. |
| `MONGODB_URI` | **Yes in production** | Must point at a transaction-capable MongoDB **replica set** (stock reservation, material issue, and receipt processing all require multi-document transactions). The server refuses to start in production if this is unset, and separately refuses to start if the connected deployment turns out not to be a replica set. Defaults to a local standalone instance in development. |
| `JWT_SECRET` | **Yes in production** | Signs and verifies auth tokens. Must be at least 32 random characters - the server refuses to start otherwise. There is no hardcoded fallback; generate one with `openssl rand -hex 32`. A development-only fallback is used automatically when unset outside production. |
| `CORS_ORIGIN` | **Yes in production** | Comma-separated list of trusted frontend origins (e.g. `https://app.example.com`). No wildcard is accepted. In development, all origins are allowed if left unset. |
| `COMPANY_ADDRESS`, `COMPANY_GSTIN`, `COMPANY_LOGO_PATH` | No | Optional branding printed on generated Delivery Challan / Job Receipt PDFs. Omitted from the PDF entirely if unset - never fabricated. When no logo path is set (or it doesn't exist), `server/assets/company-logo.png` is used if present. |

### Client (`client/.env`)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | No | Base URL of the backend API, including the `/api` prefix. Leave unset for a same-origin deployment (default relative `/api` path, matching the dev proxy in `vite.config.ts`). Set only when the frontend and backend are hosted on different origins. |
