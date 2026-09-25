# KitchenOS

**The calm intelligence layer for independent food businesses.** A cinematic marketing site plus a
tenant-scoped operations dashboard: inventory signals, menu intelligence, an AI-assisted recipe
builder, and a human-approved procurement desk.

Built with React 19 + Vite + Tailwind 4 on the front, Express 5 + tRPC 11 + Drizzle ORM on the
back, and MySQL 8 for storage.

## Quick start

Prerequisites: **Node 22+**, **Docker Desktop** (for the local database), and **pnpm** via
corepack (`corepack enable pnpm`, or just prefix commands with `corepack`).

```bash
corepack pnpm install          # install dependencies
docker compose up -d           # start local MySQL (kitchenos-mysql container)
corepack pnpm db:push          # create tables from drizzle/schema.ts
corepack pnpm db:seed          # populate the demo workspace with realistic data
corepack pnpm dev              # dev server on http://localhost:3000
```

The dev server serves the React app (with HMR) and the tRPC API on the same port. A `.env` file is
required — see `.env` keys below.

### Try it

1. Open http://localhost:3000 — the marketing site with waitlist capture.
2. Go to `/local-login` and create a local test account (12+ char password with upper, lower, and a
   number), or sign in with one you created.
3. You'll be redirected to `/app` — manage inventory (add items, adjust quantities and minimum
   levels), build recipes, draft purchases, and approve them. Every record is scoped to your
   organization, and the dashboard metrics (low-stock count, expiring items) are computed live from
   your own data.

Or skip the empty state entirely: `pnpm db:seed` (run once, after `db:push`) provisions the demo
account — **demo@restaurant.test** / `StrongPassphrase9` — with the "Harbor Kitchen" workspace
pre-filled with 16 inventory items (a few deliberately below minimum level), a 10-item menu with
classifications, one recipe, 4 purchase drafts (3 pending approval), and 3 swarm notes. Re-running
the seed never duplicates data — it only inserts what's missing.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with Vite HMR + tRPC API (tsx watch) |
| `pnpm build` | Production build (client → `dist/public`, server → `dist/index.js`) |
| `pnpm start` | Run the production build (`NODE_ENV=production`) |
| `pnpm check` | TypeScript typecheck |
| `pnpm test` | Vitest test suite (API boundaries, auth logout, security headers) |
| `pnpm format` | Prettier |
| `pnpm db:push` | Generate + apply Drizzle migrations to `DATABASE_URL` |
| `pnpm db:seed` | Idempotently seed the demo workspace (`demo@restaurant.test`) with inventory, menu, purchases, a recipe, and swarm notes |

## Environment variables

`.env` (git-ignored) — required locally:

- `DATABASE_URL` — MySQL connection string (docker-compose default:
  `mysql://kitchenos:kitchenos@127.0.0.1:3306/kitchenos`)
- `JWT_SECRET` — 32+ character session-signing secret
- `PORT` — defaults to 3000

Optional integrations (features degrade gracefully when unset):

- `LLM_API_KEY`, `LLM_API_URL` — enables the AI ingredient parser (any OpenAI-compatible endpoint)
- `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_AUTHORIZATION_URL`, `OAUTH_TOKEN_URL`,
  `OAUTH_USERINFO_URL`, `OAUTH_CALLBACK_URL`, `OAUTH_SCOPES` — enables OAuth sign-in at
  `/api/oauth/login` alongside the local test login
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` — enables recipe photo uploads via managed
  object storage
- `ENABLE_LOCAL_AUTH=true` — exposes the local password login in production builds (off by default)

## Architecture

```
client/          React 19 SPA (Vite + Tailwind 4 + shadcn/radix UI, wouter routing)
  src/pages/     Home (marketing), KitchenDashboard (/app), LocalLogin
server/
  _core/         Entry point, tRPC wiring, sessions, OAuth routes, LLM + storage helpers
  routers.ts     tRPC procedures: auth, waitlist, workspace, swarm, recipes, procurement
  db.ts          Drizzle data access — every query is tenant-scoped by organizationId
  localAuth.ts   Signed local-session cookie (JWT via jose), dev/testing fallback
  recipeParser.ts  LLM ingredient extraction (structured output, untrusted-input guarded)
  recipePhotos.ts  Upload route with sharp re-encode (strips EXIF), 5 MB limit
drizzle/         Schema + generated SQL migrations (MySQL)
shared/          Types and constants shared by client and server
```

### Security posture

- All workspace reads/writes resolve the tenant from the **server-side session**, never client input
- bcrypt (cost 12) password hashing; JWT session cookies (HttpOnly, Secure, SameSite per transport)
- Rate limiting: global (240 req/15 min on the API) plus per-feature throttles (login, waitlist,
  parser)
- Helmet CSP, Permissions-Policy, nosniff, no-referrer in production
- Role gates: only owner/manager/chef create recipes and drafts; only owner/manager approve them

## Tests

`pnpm test` covers tRPC authorization boundaries (unauthenticated rejection, tenant scoping from
verified identity, role gates, throttling), logout cookie clearing, and production security
headers/SPA fallback/rate limiting via supertest.

## Deploying

See [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md) for a Vercel walkthrough (Express adapter + external MySQL
+ the `ENABLE_LOCAL_AUTH` decision), or [DEPLOY_RENDER.md](DEPLOY_RENDER.md) for a zero-code-change
Render deploy. In short: point `DATABASE_URL`
at an external MySQL, set a fresh `JWT_SECRET`, configure OAuth/LLM/storage providers, run
`corepack pnpm install --frozen-lockfile && corepack pnpm run build`, and start with `pnpm start`
(the server binds to Render's `PORT`).
