# KitchenOS — Project Report

**What it is, what problem it solves, how it was built, everything that was done, and the
failures faced on the way.** Companion document: `SYSTEM_DESIGN.md` (architecture deep-dive)
and `DEPLOY_VERCEL.md` / `DEPLOY_RENDER.md` (deployment).

---

## 1. Executive summary

KitchenOS is a web application that gives an independent restaurant one calm, private
dashboard for the back office: live inventory with low-stock and expiry signals, menu
intelligence with contribution-margin analytics, an AI-assisted recipe builder, a
human-approved procurement desk, and a shared "swarm" notes board — all wrapped in a
cinematic marketing site with waitlist capture.

It was delivered as a **complete, running, tested system**: React 19 + Vite + Tailwind 4 on
the front, Express 5 + tRPC 11 + Drizzle ORM on the back, MySQL 8 for storage. Final state:
**typecheck clean, 20/20 automated tests passing, production build verified, live
end-to-end flows verified in a real browser.**

---

## 2. The problem it solves

An independent restaurant owner today juggles a clipboard (or three), a spreadsheet,
supplier WhatsApp threads, and a POS export nobody opens. The specific pains:

| Pain | KitchenOS answer |
|---|---|
| Stock counts exist only in someone's head | Live inventory ledger with units, minimum levels, expiry dates; low-stock and 48-hour-expiry metrics computed continuously |
| "What should we use first?" is tribal knowledge | FEFO (first-expired-first-out) shelf that surfaces the nearest-expiry item automatically |
| Menu profitability is invisible until month-end | Sales-weighted food-cost %, per-dish contribution-margin chart, sales-mix donut, and a stars/premium/workhorse/rework map — computed from real rows |
| Purchases happen reactively or not at all | Procurement drafts with supplier + rationale, deliberately held for **human** approval before becoming commitments |
| Knowledge lives in one person | Swarm notes move observations through four lanes (observe → prepare → approve → learn) |
| A daily judgment call ("what do we prep for tonight?") is unsupported | A deterministic daily briefing that names the most urgent item, quantifies the gap, links pending drafts, and can be saved to the manager-approval lane |

**Design stance:** software assists the decision, the human makes it. No automated
purchasing, no silent AI actions — every consequential write is an explicit, role-gated,
human-triggered action.

---

## 3. The pipeline — how the project came together

The project started as a **template that could not run**: source files were missing,
dependencies were never installed, and there was no database or environment configuration.
The delivery pipeline, in order:

### 3.1 Inventory and forensics
Mapped every import across 117 project files to discover the missing surface: eight server
core files (`env`, `cookies`, `session`, `sdk`, `oauth`, `llm`, `systemRouter`) plus shared
error types and the client auth hook — all referenced by surviving code but absent from disk.

### 3.2 Reconstruction
Rebuilt the missing layer against the interfaces the surviving code expected: JWT session
signing/verification (`jose`, HS256), cookie helpers, a generic OAuth flow, an
OpenAI-compatible LLM client, tRPC system router, and shared error types.

### 3.3 Environment and infrastructure
Installed the pinned dependency set (approving build scripts for esbuild and Tailwind's
native oxide package on Windows), generated a cryptographic JWT secret, and stood up MySQL 8
in Docker with a healthcheck. Applied the 12-table schema via Drizzle migrations.

### 3.4 Verification-first development
Established three gates early and ran them after every change: `tsc --noEmit` (types),
`vitest` (authorization and security boundaries), and the production build. The existing
test suite was treated as the contract — one missing test fixture was reconstructed so the
security tests could exercise real files.

### 3.5 Feature growth (each step verified end-to-end)
1. **Demo seed** — idempotent seeding of a realistic workspace (16 inventory items, 10 menu items, 4 purchase drafts, a recipe, 3 swarm notes).
2. **Inventory CRUD** — add items, adjust quantity/minimum levels, server-side tenant scoping and role gates; dashboard metrics recompute live.
3. **Menu studio + analytics** — menu-item creation with a classification hint; recharts analytics (contribution margin, sales mix, headline stats); real food-cost metric; live menu quadrant.
4. **Daily briefing** — deterministic generation from live data with a traceable rationale panel and one-click "save for manager review" into the swarm board.

### 3.6 Continuous verification
After every feature: typecheck → tests → live API probes (including negative tests for
auth and tenant boundaries) → browser verification through the preview pane. Documentation
(README, deployment guides, this report, the system design) was written last, from the
verified state rather than the plan.

---

## 4. Everything that was done

**Reconstructed infrastructure (the app could not boot without it)**
- Server core: env config, cookie helpers, JWT session layer, SDK/session bridge, generic OAuth login + callback, LLM client, tRPC system router, shared error types
- Client: authentication hook wired to the session-aware tRPC client

**Environment and tooling**
- Dependency installation with Windows script-approval workarounds; `.env` with generated secrets; Dockerized MySQL with healthcheck; schema migration; `.npmrc` and port-validation fixes

**Demo data system**
- Idempotent seed script (`pnpm db:seed`): realistic tenant with deliberately low-stock and near-expiry items so every signal has something real to report

**Product features**
- Inventory: create + adjust (quantity, minimum) with live low-stock flags and metric recomputation
- Menu studio: create dishes with price/cost/sales and automatic classification hint
- Analytics: contribution-margin stacked bar, sales-mix donut, food-cost %, average margin, units sold, star count — all computed from tenant rows
- Daily briefing: data-derived headline, quantified rationale, save-to-review workflow
- Procurement desk: drafts with supplier/rationale, owner/manager-only approval (pre-existing, verified and integrated into the briefing flow)

**Quality**
- 20 automated tests covering auth rejection, tenant isolation, role gates, throttling, password policy, cookie clearing, and production security headers
- Three new boundary tests for inventory and menu writes (server-scoped identity, staff/analyst rejection, cross-tenant 404)

**Documentation**
- README (setup, scripts, security posture), `DEPLOY_VERCEL.md` (adapter pattern, managed MySQL, the local-auth decision), `DEPLOY_RENDER.md` (pre-existing), `SYSTEM_DESIGN.md`, this report

---

## 5. The failures — an honest log

Real failures encountered during the build, each with its fix:

1. **The project did not run at all.** Eight missing server files, no `node_modules`, no
   database, no `.env`. *Fix:* full reconstruction against surviving interfaces; Docker
   MySQL; generated secrets; schema push.

2. **pnpm blocked native build scripts** (esbuild, Tailwind oxide) on Windows — silent
   build breakage risk. *Fix:* explicit script approval in `package.json` + reinstall.

3. **Docker Desktop launch hung the terminal** when started synchronously (240 s timeout).
   *Fix:* launched detached via PowerShell `Start-Process`; polled the engine until ready.

4. **The server bound to a bogus port and crashed.** The shell environment carried
   `PORT=0`; the dev entrypoint didn't validate it. *Fix:* hardened entrypoint port
   validation (fail fast with a clear error) — a permanent robustness improvement.

5. **tsx watch wedged during a restart** after the port fix (repeated connection failures).
   *Fix:* killed all node processes and restarted cleanly; adopted detached-with-stdin-closed
   launches for dev servers.

6. **Missing test fixture** — the security test suite expected an HTML fixture that did not
   exist in the template. Three tests failed. *Fix:* reconstructed the fixture; suite went
   fully green.

7. **A typecheck caught scoping bugs before they shipped** — two derived values referenced
   before definition after a large dashboard refactor. *Fix:* re-scoped variables; re-ran
   gates. (The gates did their job.)

8. **Seed data silently vanished from the dashboard**: new inventory items were added
   successfully but the workspace snapshot capped inventory at 12 rows (a preview-era
   limit), so new items were invisible and menu analytics missed rows. *Fix:* raised the
   snapshot cap to 200; flagged pagination as the proper long-term design step.

9. **The AI-briefing buttons did nothing** — "See rationale" and "Save for manager review"
   were dead static UI. *Fix:* briefing made data-derived with a working rationale panel and
   a real save-to-swarm flow.

10. **Browser-automation friction during E2E verification**: preview tab detachment, a
    transient 500 on the login route during Vite dependency re-optimization, and clicks
    landing on stale page elements. *Fix:* re-attached tabs, retried after the optimizer
    settled, and submitted forms programmatically — the app itself was healthy (curl
    confirmed 200s throughout); only the tooling wobbled.

11. **Screenshots failed to composite** in the desktop environment during visual checks.
    *Fix:* verified via accessibility-tree snapshots and DOM assertions instead — arguably
    a stricter check.

**Design-level failures inherited from the template (fixed or scheduled):** a 404-in-prod
local-auth endpoint (now a documented, intentional posture with an explicit env flag), and
single-instance rate limiting (Redis backlog item).

---

## 6. Verification summary

| Gate | Result |
|---|---|
| `pnpm check` (typecheck) | Clean |
| `pnpm test` | 20/20 passing |
| `pnpm build` (production) | Client + server bundle OK; production server verified live |
| Live API E2E | Auth (register/login/logout), workspace isolation, inventory add/update, menu add, recipes, procurement approve, briefing save — all verified, including 401/403/404 negative paths |
| Browser E2E | Landing, login, dashboard with live metrics/charts, inventory adjust reflected in metrics, briefing save flow |

**Proven isolation example:** a freshly registered account sees 0/0/0 rows while the demo
account simultaneously sees all of its own — on the same server, same database.

---

## 7. What comes next

- Procurement ↔ inventory link: one-click draft generation for below-minimum items
- Inventory movement ledger (receive/waste/adjust) → stock-trend charts and variance detection
- Sales fact table (POS import) → real demand forecast replacing the labeled preview
- Pagination for large tenants; Redis-backed rate limiting for multi-instance deploys
- Soft-delete with restore; presigned direct photo uploads
