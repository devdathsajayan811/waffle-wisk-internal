# Waffle Wisk Internal Portal

Point-of-sale and back-office portal for Waffle Wisk: carts and checkout, receipts, products and price history, inventory, material requests, staff accounts, sales reports, and an audit log.

- **Frontend:** React 19, Vite, Tailwind, React Router (`src/`)
- **API:** Express 5 (`server/`), served locally by `server/index.ts` and on Vercel by `api/index.ts`
- **Database:** SQLite, through either sql.js (local file) or libSQL/Turso (hosted)

## Local setup

```bash
npm install
cp .env.example .env        # then set JWT_SECRET (32+ characters)
npm run dev                 # API on :5000, Vite on :5173 (proxies /api and /uploads)
```

With `SEED_DEMO_DATA` unset outside production, the first start creates demo accounts `admin / admin123` and `staff / staff123` plus sample products. Change those passwords before sharing the instance.

| Command | What it does |
| --- | --- |
| `npm run dev` | API (watch mode) and Vite together |
| `npm test` | API tests (Vitest + Supertest, in-memory database) |
| `npm run build` | Type-check and build the frontend into `dist/` |

## Environment variables

See `.env.example` for the full list with comments. The important ones:

- `JWT_SECRET` (required): the server refuses to start without a 32+ character secret.
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`: switch the database to Turso. Required for any durable deployment on Vercel.
- `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: create the first admin on an empty production database (demo seeding is off in production unless `SEED_DEMO_DATA=true`).
- `BLOB_READ_WRITE_TOKEN`: product image storage on Vercel Blob.
- `CORS_ORIGINS`: extra origins allowed to call the API from a browser.

## Architecture

```
src/                 React app (pages, components, AuthContext, api client)
server/
  app.ts             Express app: security middleware, routes, error handler
  config.ts          Environment parsing and validation
  db/                Driver abstraction (sqljs.ts, libsql.ts), migrations, seed
  services/          orderService (checkout/refund in one transaction), image storage
  routes/            One router per resource; all input validated with zod
  middleware/auth.ts JWT verification; the user is reloaded from the DB on every request
  lib/               HTTP errors, validation helpers, business-timezone date ranges, audit
api/index.ts         Vercel serverless entry
```

Key rules the API enforces:

- **Checkout is one transaction.** Completing a cart validates stock, computes discount and GST from business settings, records payment, deducts stock, and writes the order, receipt, and audit entry together. A failure rolls everything back.
- **Numbers come from row ids** (`ORD-0000042`, `RCP-0000042`, `CART-0000007`), so they never collide.
- **Staff only see their own carts, orders, receipts, and sales.** Products, users, inventory, settings, audit logs, refunds, and material-request approvals are admin-only.
- **Timestamps are stored in UTC** and returned as ISO strings; "today", "7 days" and the sales chart use the business timezone from Settings (default `Asia/Kolkata`).
- **Schema changes are migrations** in `server/db/migrations.ts`. Append a new entry; never edit an applied one.
- Products are archived rather than deleted, so historical orders keep their references.

## Deploying to Vercel

1. Create a Turso database (`turso db create waffle-wisk`, then `turso db tokens create waffle-wisk`).
2. In the Vercel project, set `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and (for product images) connect a Blob store so `BLOB_READ_WRITE_TOKEN` is set.
3. Deploy. The first request runs migrations and creates the admin account.

Without Turso the app still runs on Vercel, but the database lives in the function's `/tmp` and is lost whenever the instance is recycled. The Connectivity page and `/api/status` report this as a warning.

## Database options

The code talks to the database through a small async interface (`server/db/types.ts`), so the backing store is a deployment decision. Turso is the one wired up today.

| Option | Fits when | Trade-offs |
| --- | --- | --- |
| **Turso (libSQL)** — implemented | Staying on Vercel with minimal change | Same SQLite dialect and migrations; generous free tier; adds a network hop per query; vendor-specific |
| **Supabase / Postgres** | Expect multiple locations, heavier reporting, or want managed backups and SQL tooling | Needs a Postgres driver behind the same interface and dialect changes (`AUTOINCREMENT`, `DATE(..., modifier)`, `INSERT OR IGNORE`); strongest long-term option |
| **Single VM with a SQLite file** | One shop, one server, lowest cost | Run `npm run server` behind a reverse proxy with `DATABASE_PATH` on a persistent disk; you own backups, TLS, and uptime; no Vercel |

The local sql.js driver rewrites the whole file after each write. That is fine for development, tests, and a single small shop on a VM, but it is not meant for concurrent multi-instance use.
