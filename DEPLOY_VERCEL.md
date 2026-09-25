# Deploying KitchenOS to Vercel

KitchenOS is a **single Express 5 server** that serves both the built React app and the
tRPC API on one port. That shape does not map 1:1 onto Vercel's default "static + serverless
functions" model, so read the constraint below first — then pick one of the two paths.

---

## 1. The one constraint to understand

`pnpm build` produces:

- `dist/public/` — the static React bundle (this part Vercel loves)
- `dist/index.js` — an Express server (tRPC API, auth cookies, photo uploads, security headers)

Vercel has **no persistent server** by default; it runs serverless functions. The Express
server can still run there — but only inside a serverless **adapter** (section 3). If you
would rather not add an adapter at all, a small VPS/Render/Railway deploy runs the exact
same build with zero code changes (section 6).

---

## 2. What works as-is on Vercel

| Piece | Status |
|---|---|
| React client (Vite build) | ✅ Deploy as static assets |
| tRPC API over HTTP | ✅ Inside the adapter (one function) |
| Cookie sessions (JWT via `jose`) | ✅ Stateless — works on serverless |
| MySQL via Drizzle | ✅ With an external MySQL host (section 4) |
| Recipe photo uploads (`multer` memory storage) | ✅ Small files OK; large-scale use should move to object storage |
| WebSockets / HMR | ❌ Dev-only features, not needed in prod |

---

## 3. Path A (recommended on Vercel): static + one Express function

The cleanest approach without changing app code is a tiny adapter that mounts
`dist/index.js` as a catch-all serverless function. Two common options:

1. **`@vercel/node` + a catch-all route** — add `api/index.ts` that imports the built
   server and exports a handler, plus a `vercel.json` that routes every non-static
   request to it.
2. **Community adapters** such as `vercel-express` templates or `hono/vercel`-style
   wrappers — same idea, prepackaged.

Sketch of the wiring (adapt paths to your final layout):

```jsonc
// vercel.json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist/public",
  "routes": [
    { "src": "/assets/(.*)", "dest": "/assets/$1" },
    { "src": "/(.*)", "dest": "/api" }   // everything else → Express function
  ]
}
```

```ts
// api/index.ts (build with esbuild, --packages=external, like the server bundle)
import app from "../dist/index.js";
export default app; // @vercel/node wraps Express apps automatically
```

Notes:

- Set `NODE_ENV=production` in the Vercel project settings.
- The server reads `PORT` automatically on Vercel; locally it stays on 3000.
- File writes are ephemeral on serverless — recipe photos are stored in memory and
  metadata in MySQL, which is fine, but do not rely on the local filesystem.

---

## 4. The database: Vercel has no MySQL

Bring your own MySQL. Options that work with Drizzle + `mysql2` as-is:

| Host | Free tier | Notes |
|---|---|---|
| **PlanetScale** | Yes (hobby) | MySQL-compatible, serverless-friendly HTTP driver optional; most common Vercel pairing |
| **TiDB Cloud** | Yes (serverless) | MySQL 8 compatible; generous free tier |
| **Amazon RDS / Aurora MySQL** | No | Works; needs VPC peering or public access + TLS |
| **Railway / Fly MySQL** | Cheap | Fine for demos |

Steps:

1. Create the database and copy the connection string, e.g.
   `mysql://user:pass@host:3306/kitchenos?sslaccept=strict`
2. Run migrations **once** against it (from your machine or CI):
   ```bash
   DATABASE_URL="mysql://..." corepack pnpm db:push
   DATABASE_URL="mysql://..." corepack pnpm db:seed   # optional demo data
   ```
3. Put the same string in Vercel env vars (section 5).

---

## 5. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | ✅ | Your MySQL connection string (with `?sslaccept=strict` for hosted DBs) |
| `JWT_SECRET` | ✅ | 32+ random chars — **generate a new one for production**, never commit it |
| `NODE_ENV` | ✅ | `production` |
| `ENABLE_LOCAL_AUTH` | ⚠️ decision | See section 5.1 |
| `MANUS_CLIENT_ID` / `MANUS_CLIENT_SECRET` / `OAUTH_REDIRECT_URL` | optional | Only if you keep the primary OAuth flow (requires a registered OAuth app) |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | optional | Enables AI ingredient parsing; app degrades gracefully without it |
| `APP_OWNER_OPEN_ID` | optional | Promotes that account to admin |

Generate a strong secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 5.1 The sign-in decision (important)

In production, local email/password sign-in is **disabled by design** (`auth.loginLocal`
returns 404) unless you set `ENABLE_LOCAL_AUTH=true`. Your options:

1. **Keep OAuth only** (default posture): real users sign in through the registered OAuth
   provider. Most secure; needs the OAuth env vars above.
2. **Enable local auth** (`ENABLE_LOCAL_AUTH=true`): anyone with an email/password can
   register. Fine for a personal demo or a small trusted team — every account gets its own
   isolated workspace automatically — but it is an open registration endpoint on the
   public internet, protected only by rate limits.

For "whoever uses it creates a personalized account" on a public Vercel URL, option 2 is
the pragmatic choice; revisit before inviting real businesses.

---

## 6. Path B (zero code changes): Render / Railway / Fly / a $5 VPS

If the adapter feels like friction, the same `pnpm build` + `node dist/index.js` runs
unchanged on any PaaS that hosts a Node server — see the existing `DEPLOY_RENDER.md` in
this repo. You keep one always-on process, real file storage, and no cold starts.

---

## 7. Pre-flight checklist

- [ ] `pnpm check && pnpm test && pnpm build` all pass locally
- [ ] `db:push` (and optionally `db:seed`) ran against the production database
- [ ] `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV` set in Vercel
- [ ] Local-auth decision made and configured (section 5.1)
- [ ] HTTPS cookie behavior verified (`getSessionCookieOptions` handles secure cookies automatically behind Vercel's proxy)
- [ ] Health probe: `GET /api/trpc/system.health?batch=1&input={"0":{"json":null}}` returns `{"status":"ok"}`

---

*TL;DR: Vercel works, but the app is a classic single-server Node app — add the Express
adapter (Path A) or deploy the same build to Render/Railway/Fly with zero changes
(Path B). Either way, bring your own MySQL and make a conscious choice about
`ENABLE_LOCAL_AUTH`.*
