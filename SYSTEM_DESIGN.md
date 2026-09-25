# KitchenOS — System Design

**A calm operations layer for independent restaurants.** This document describes the system
as built: architecture, data model, request lifecycle, security model, analytics pipeline,
deployment topologies, failure modes, and the design's known limits with an evolution path.

---

## 1. Design goals and constraints

| Goal | Design consequence |
|---|---|
| One person (owner/chef) runs the whole back office | Single-page dashboard, not a multi-screen ERP |
| Every restaurant's data is private | Tenant isolation enforced server-side on every query |
| Trust human judgment over automation | AI only drafts/briefs; approvals are explicit human actions |
| Works offline-ish in a busy kitchen | One server, one DB, no microservices to babysit |
| Deployable by one developer | Single Node process, single MySQL, stateless auth (JWT cookies) |

Explicit non-goals (v1): real-time POS integration, multi-restaurant rollups, offline sync.

---

## 2. High-level architecture

```
┌──────────────────────────── Browser — React 19 SPA ────────────────────────────┐
│  Marketing site (/)     Local login (/local-login)     Dashboard (/app)        │
│                                                                                │
│  React Query cache  ←→  tRPC client (superjson, credentials: same-origin)      │
│  Derived views: metrics · recharts analytics · daily briefing · FEFO shelf     │
└──────────────▲────────────────────────────────────────────────▲────────────────┘
               │ POST/GET /api/trpc/*  (httpOnly JWT cookie)    │ /  (static assets)
┌──────────────┴──────────── Single Express 5 process ──────────┴────────────────┐
│  security.ts: helmet CSP · rate limits · Permissions-Policy · no x-powered-by  │
│                                                                                │
│  tRPC v11 router ── context per request:                                       │
│      JWT verify (jose) → user → getOrganizationForUser → { org, restaurant,    │
│      role }  ← the ONLY source of tenant identity (never client input)         │
│                                                                                │
│  routers: auth · workspace · inventory · menu · recipes · procurement ·        │
│           swarm · system                                                       │
│                                                                                │
│  db.ts (Drizzle ORM, typed SQL) ──► MySQL 8                                    │
│  recipeParser ──► OpenAI-compatible LLM (optional; degrades gracefully)        │
│  recipePhotos ──► sharp sanitize ──► object storage (optional)                 │
│                                                                                │
│  dev: Vite middleware + HMR (tsx watch)     prod: serves dist/public           │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Key decision — one server, one port.** The Express process serves the API *and* the static
client. This removes CORS, proxying, and second-deploy complexity for a single-operator
product. The trade-off (serverless platforms need an adapter) is documented in
`DEPLOY_VERCEL.md`.

**Key decision — typed end-to-end.** One `AppRouter` type is shared from
`server/routers.ts` to the client via `trpc.ts`, so the client's queries/mutations and the
server's procedures can never drift silently.

---

## 3. Data model

```
users ──1:n── memberships ──n:1── organizations ──1:n── restaurants
  │                                   │
  └──1:1── local_credentials          ├──1:n── swarm_notes
                                      └──(currency, timezone on org)

restaurants ──1:n── inventory_items   (quantity, unit, minimumLevel, expiresAt)
restaurants ──1:n── menu_items        (price, ingredientCost, salesCount, classification)
restaurants ──1:n── recipes ──1:1── recipe_photos (storageKey, sanitized bytes)
restaurants ──1:n── purchase_drafts  (status: draft → approved, approvedBy/at)

waitlist_entries (marketing, standalone)
```

- **Membership is the tenancy join**: a user reaches data only through
  `memberships → organizations → restaurants`. There is no tenant id in any client request.
- **Money is `DECIMAL(10,2)`** in MySQL and string-typed through the API — never floats.
- **Roles** live on the membership (`owner | manager | chef | staff | analyst`), so the same
  person can hold different roles in different organizations.

## 4. Request lifecycle (the core flow)

Every write follows the same five gates, in order:

```
client form
  → zod validation (client mirror, UX only)
  → tRPC mutation
  → ① authentication: verify JWT cookie → user (401 if absent)
  → ② tenant resolution: workspaceFor(ctx.user.id) → {org, restaurant, role}
  → ③ authorization: role gate (owner/manager/chef write; owner/manager approve)
  → ④ input validation: zod schema (bounds, lengths, enums, sanitization)
  → ⑤ tenant-scoped SQL: WHERE organizationId = resolved.org AND restaurantId = resolved.rest
```

The UI updates via **React Query invalidation**, not local patching: any successful mutation
calls `utils.workspace.current.invalidate()`, the snapshot refetches, and every derived view
(metric cards, charts, quadrant, briefing, low-stock flags) recomputes from server truth.
There is exactly **one** source of data in flight at any time.

## 5. Security design

| Layer | Mechanism |
|---|---|
| Authentication | OAuth (primary) + local email/password; both issue an httpOnly, SameSite JWT cookie signed with `JWT_SECRET` (HS256, `jose`), 8 h expiry |
| Password storage | bcrypt cost 12; strength policy enforced before persistence |
| Authorization | Role matrix per procedure; approval restricted to owner/manager |
| Tenant isolation | Resolved server-side from the session; never from input; tested by "cross-tenant id → 404" tests |
| Input safety | zod on every procedure; recipe text treated as untrusted (LLM output is a *draft* the user edits); photos re-encoded with `sharp` (EXIF stripped) |
| Abuse control | express-rate-limit on `/api/trpc` + per-procedure in-memory throttles (auth, waitlist, parser) |
| Transport/headers | Helmet CSP (strict in production), Permissions-Policy, no-referrer; secure cookies auto-enabled behind HTTPS proxies |

**Deliberate posture:** local password registration is disabled in production unless
`ENABLE_LOCAL_AUTH=true` — an explicit, documented trade-off between openness and abuse
surface for a public deployment.

## 6. Analytics pipeline (derive-on-read)

There is no analytics store; all analytics are **pure functions over the tenant snapshot**,
computed at render time:

```
workspace.current snapshot
  ├─ foodCostPct   = Σ(cost×sales) / Σ(price×sales)            (sales-weighted)
  ├─ marginData    = per dish: { cost, price − cost }           → stacked bar
  ├─ mixData       = top-6 dishes by salesCount                 → donut
  ├─ quadrant      = counts by classification                   → menu map
  ├─ lowStock / FEFO / expiring-48h                           → metrics + shelf
  └─ describeBriefing()  → deterministic headline + rationale  (rules, not an LLM)
```

**Why deterministic rules instead of AI for the briefing:** every sentence must trace to a
row on screen (auditable, instant, free, offline). The LLM is reserved for the one task that
needs it — parsing messy ingredient notes.

**Classification heuristic** (for new items with no history): margin ≥ 35% → star,
≥ 28% → workhorse, ≥ 20% → premium, else rework; zero sales → workhorse with a note.

## 7. Deployment topologies

```
A) Local/dev         Docker MySQL  ──  node (tsx watch + Vite HMR) :3000
B) Single server     Docker MySQL  ──  node dist/index.js behind Nginx/HTTPS (Render/Railway/VPS)
C) Vercel            Managed MySQL (PlanetScale/TiDB) ── static dist/public + Express-in-function adapter
```

Config is 12-factor via env: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`,
`ENABLE_LOCAL_AUTH`, optional `OPENAI_*`, OAuth and storage keys. Migrations are
`drizzle-kit generate && migrate` (`pnpm db:push`), with `pnpm db:seed` idempotently
provisioning a demo tenant.

## 8. Failure modes and graceful degradation

| Failure | Behavior |
|---|---|
| `OPENAI_API_KEY` missing/LLM down | Parser mutation returns a friendly error; recipe builder remains fully usable manually |
| Storage keys missing | Photo upload disabled; everything else unaffected |
| Database unreachable | Health endpoint reports failure; UI keeps rendering with error state, no data loss risk |
| `JWT_SECRET` missing/too short | Local auth refuses to sign (fail closed) rather than issuing insecure tokens |
| Port invalid/occupied | Entrypoint validates `PORT` and exits with a clear error (hardened after a real incident) |
| Invalid input at any boundary | 400 with field-safe message; nothing persists |

## 9. Known limits → evolution path

| Current limit | Next design step |
|---|---|
| Snapshot cap (200 rows/tenant) | Pagination + server-side filtering per section |
| No inventory *history* (current state only) | `inventory_movements` ledger (append-only: receive/waste/adjust), enabling trend charts and variance detection |
| `salesCount` is a manual period counter | `sales_events` fact table fed by POS import; real demand forecast from day-of-week patterns |
| In-memory rate limits | Redis-backed limiter when running multi-instance |
| Photos via memory storage + object store | Presigned direct uploads |
| No deletion (audit safety) | Soft-delete/archive flags + restore |
| Single-region MySQL | Read replica + point-in-time backups as tenancy grows |

The schema was designed so none of these steps require breaking existing tenants: new tables
and columns are additive.
