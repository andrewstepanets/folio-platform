# PRD: folio-platform — MVP

**Repository:** `folio-platform`
**Status:** Draft → needs-triage
**Owner:** @andrewstepanets
**Target:** MVP delivery in 8 weeks at ~8 hours/week

---

## Problem Statement

People who want to learn cryptocurrency trading or test portfolio strategies face a poor set of options. Real exchanges require KYC, deposits, and put real capital at risk for users who only want to experiment. Most paper-trading simulators run on delayed or synthetic data, so they don't show how a portfolio actually behaves under live market volatility. Existing demo accounts on major exchanges still demand full registration flows and aren't optimized for short, exploratory sessions. There is no fast, friction-free way to get hands-on with a virtual portfolio that responds to real market movement in real time.

## Solution

`folio-platform` is a web-based cryptocurrency portfolio simulator using live market data. A user signs up with email and password in under 30 seconds, receives a $10,000 virtual USD balance, and immediately sees live quotes for the top 10 cryptocurrencies streamed from Binance public market data. Buy and sell orders execute instantly at the current market price; portfolio value, holdings, and unrealized P/L update in real time as quotes move. There is no KYC, no real money, and no risk — only an authentic experience of operating a portfolio against a volatile live market. The platform is delivered as a public web application with full operational tooling (CI/CD, automated deploys, daily backups, cost monitoring) so it runs reliably under a strict infrastructure budget.

## User Stories

### Authentication
1. As a **visitor**, I want to register with email and password, so that I can start using the platform.
2. As a **visitor**, I want to log in with my credentials, so that I can access my portfolio.
3. As a **registered user**, I want my session to persist via JWT, so that I don't have to log in on every page reload.
4. As a **registered user**, I want to log out, so that my session is invalidated on the current device.
5. As a **new user**, I want to receive a starting virtual USD balance ($10,000) on registration, so that I can immediately start trading without a funding flow.

### Portfolio overview
6. As a **logged-in user**, I want to see my current portfolio value in USD, so that I know what my holdings are worth right now.
7. As a **logged-in user**, I want to see my unrealized P/L in absolute USD and percentage, so that I can evaluate my trading decisions.
8. As a **logged-in user**, I want to see a list of my holdings with quantity, average buy price, current price, and per-asset P/L, so that I can analyze each position.
9. As a **logged-in user**, I want to see my available cash balance, so that I know how much I can spend on new orders.

### Market data
10. As a **logged-in user**, I want to see a list of available assets (top 10 cryptocurrencies: BTC, ETH, SOL, etc.), so that I can choose what to trade.
11. As a **logged-in user**, I want live quote updates for all displayed assets via WebSocket, so that I see current market prices without refreshing.
12. As a **logged-in user**, I want to see a candlestick chart for a selected asset with multiple intervals (1m, 5m, 1h, 1d), so that I can analyze price history.
13. As a **logged-in user**, I want the chart's last candle to update in real time as new ticks arrive, so that the chart reflects current market state.

### Trading
14. As a **logged-in user**, I want to place a buy order specifying an asset and USD amount, so that I can acquire that asset at the current market price.
15. As a **logged-in user**, I want to place a sell order specifying an asset and quantity (or "sell all"), so that I can liquidate a position at the current market price.
16. As a **logged-in user**, I want the system to reject a buy order if my balance is insufficient, so that I can't go into negative cash.
17. As a **logged-in user**, I want the system to reject a sell order if I don't hold enough of the asset, so that I can't short-sell.
18. As a **logged-in user**, I want my order to execute atomically (balance debited, holding updated, transaction recorded in one DB transaction), so that the system never ends up in a half-applied state.
19. As a **logged-in user**, I want to see confirmation immediately after placing an order, so that I know it was accepted.

### Real-time updates
20. As a **logged-in user**, I want to see a history of my transactions (filled orders) with timestamp, asset, side, quantity, price, and total, so that I can audit my activity.
21. As a **logged-in user**, I want my portfolio value to update in real time as quotes change, so that I see live net worth without refreshing.
22. As a **logged-in user**, I want to be notified (UI toast) when my order is filled, so that I get immediate feedback.
23. As a **logged-in user**, I want all monetary values displayed with appropriate precision (USD: 2 decimals, crypto: 8 decimals), so that values are readable and accurate.

### Discoverability and platform reach
24. As a **mobile user**, I want the dashboard to be usable on a phone screen, so that I can check my portfolio on the go.
25. As a **first-time visitor**, I want to land on a clear marketing page explaining the product, so that I can decide whether to try it.
26. As a **first-time visitor**, I want a "Try demo account" button on the marketing page, so that I can explore the product immediately without committing to registration.

### Platform reliability (operational requirements)
27. The platform protects itself from request floods through rate limiting on authentication and order endpoints, so that no single client can degrade availability for others.
28. Every push to the main branch triggers automated CI (lint, typecheck, tests) so that broken code is caught before merge.
29. Every push to the main branch deploys to production automatically after CI passes, so that the production environment always reflects the merged source of truth.
30. Postgres data persists across container rebuilds and deployments, so that user data is not lost on routine operations.
31. The Postgres database is backed up daily to durable off-host storage with a documented restore procedure, so that data is recoverable from accidental loss.
32. The public URL serves traffic over HTTPS with auto-renewing certificates, so that the site stays secure without manual intervention.
33. Application logs are accessible from the production host, so that operators can diagnose issues without rebuilding or redeploying.

## Implementation Decisions

**Architecture pattern**

Modular monolith deployed as separate web/api containers behind nginx on a single EC2 instance. No microservices, no separate worker process for MVP. Async work via in-process BullMQ jobs sharing Redis with the cache layer. This is deliberate — splitting into services adds operational complexity that the MVP doesn't justify.

**Repository structure**

pnpm monorepo with `apps/web` (Next.js App Router), `apps/api` (NestJS), `packages/shared` (types, Zod schemas shared between web and api), `packages/database` (Prisma schema, migrations, seed). `infra/` directory holds docker-compose files, nginx config, GitHub Actions workflows, and EC2 bootstrap script.

**Modules to build**

Auth Module exposes `register`, `login`, `validateToken`. JWT with HS256, 7-day expiry, stored in httpOnly cookie. Password hashing via argon2id. No refresh tokens in MVP — re-login after expiry is acceptable.

Portfolio Module exposes a pure `valuate(holdings, quotes) → PortfolioValuation` function plus a thin persistence layer. Valuation is currency-correct (decimal arithmetic via decimal.js, never floating-point on money).

Pricing Module owns the Binance WebSocket connection, normalises incoming ticks into internal `Quote` objects, writes the latest Quote to Redis (key per Asset), aggregates ticks into Candles (1m primary, others derived on read), and persists closed Candles to Postgres. Exposes `getLatestQuote(assetId)`, `getCandles(assetId, interval, range)`, and a NestJS Observable for live Quote streams.

Order Module exposes a single primary method `placeOrder(userId, intent) → OrderResult`. Internally: opens a Postgres transaction, locks the User row with `SELECT ... FOR UPDATE`, validates Balance/Holding, fetches the latest Quote from Redis, debits/credits Balance, upserts Holding (recalculating volume-weighted average buy price on buys), inserts a Transaction row, commits. Returns OrderResult with status filled/rejected and reason. No partial fills, no order book — execution is instant at last known Quote (this is a simulator).

Market Data Gateway is a NestJS WebSocket Gateway. On connection: authenticates via JWT from cookie, subscribes the socket to `quote.*` events for assets the user is watching, pushes `portfolio.updated` when this user's Holdings change, pushes `order.filled` when this user's Order completes. Backed by Redis pub/sub so it can scale horizontally later (not needed for MVP, but trivial to keep this property).

Web App uses Next.js App Router. Three primary routes: `/` (marketing + login/register), `/dashboard` (portfolio overview, holdings table, asset selector, chart, recent transactions), `/trade/[asset]` (trade form). Client-side WebSocket connection initialised in a top-level client component, distributes events via React Context. Charts via TradingView Lightweight Charts (free, MIT, designed for exactly this use case).

**Schema (Prisma)**

User: id, email (unique), passwordHash, balanceCents (BigInt, USD cents to avoid float), createdAt.

Asset: id, symbol (unique, e.g. "BTCUSDT"), displayName, decimals (8 for crypto), isActive. Seeded from a fixed list of ~10 top cryptos.

Holding: id, userId, assetId, quantity (Decimal), averageBuyPriceCents (BigInt). Unique on (userId, assetId).

Order: id, userId, assetId, side (BUY/SELL), intentType (USD_AMOUNT/QUANTITY), intentValue (Decimal), status (PENDING/FILLED/REJECTED), rejectionReason (nullable), executedQuantity (nullable Decimal), executedPriceCents (nullable BigInt), createdAt, filledAt.

Transaction: id, orderId, userId, assetId, side, quantity (Decimal), priceCents (BigInt), totalCents (BigInt), createdAt. Append-only, never updated.

Candle: id, assetId, interval, openTime, open/high/low/close (BigInt cents), volume (Decimal). Unique on (assetId, interval, openTime).

**API contracts**

`POST /auth/register` { email, password } → { user, tokenSetAsCookie }.
`POST /auth/login` { email, password } → { user, tokenSetAsCookie }.
`POST /auth/logout` → 204.
`GET /portfolio` → { balance, holdings: [...], totalValue, totalPnL }.
`GET /assets` → list of active Assets with latest Quote.
`GET /assets/:symbol/candles?interval=1m&from=...&to=...` → array of Candles.
`POST /orders` { assetSymbol, side, intentType, intentValue } → OrderResult.
`GET /orders?status=...&limit=...&cursor=...` → paginated Orders.
`GET /transactions?limit=...&cursor=...` → paginated Transactions.

**WebSocket protocol**

Client → Server: `{ type: "subscribe", channel: "quote", asset: "BTCUSDT" }`, `{ type: "unsubscribe", ... }`. Server → Client: `{ type: "quote.updated", asset, price, timestamp }`, `{ type: "candle.updated", asset, interval, candle }`, `{ type: "portfolio.updated", valuation }`, `{ type: "order.filled", order }`.

**Infrastructure decisions**

Single EC2 t4g.micro (ARM, Ubuntu 24.04 LTS), AWS Free Tier eligible for the first 12 months, ~£5/mo after on-demand. 8GB gp3 EBS volume. Elastic IP attached. 2GB swap file mandatory (1GB RAM is tight with Postgres + Node × 2 + Redis).

Containers managed by docker-compose: `nginx` (TLS termination, reverse proxy, WebSocket upgrade), `web` (Next.js standalone build), `api` (NestJS), `postgres` (16-alpine, volume mounted to host), `redis` (7-alpine).

TLS via Let's Encrypt + certbot in a sidecar container, auto-renewal via cron.

Domain: `.xyz` from Namecheap (~£1/year). Pointed at Elastic IP via A record.

**CI/CD pipeline (GitHub Actions)**

On PR: lint (eslint), typecheck (tsc --noEmit), test (vitest), build check.
On push to main: run all PR checks, then build linux/arm64 Docker images for web and api in parallel using buildx + QEMU, push to ghcr.io tagged with both `:latest` and `:sha-<commit>`. Final job SSHes to EC2 via `appleboy/ssh-action` and runs `docker compose pull && docker compose up -d` against a checked-in `docker-compose.prod.yml`. Rollback by setting an image tag override in a `.env` file on the server and re-running `up -d`.

**Cost discipline**

The platform operates within a strict infrastructure budget: £5/month soft target, £8/month hard ceiling. AWS Budgets is configured with alerts at both thresholds, plus a CloudWatch billing alarm at £6 as a redundant signal. Container images are stored on ghcr.io (free for public repositories) rather than AWS ECR to avoid storage and transfer charges. The repository is public from day one.

**Out-of-scope decisions deferred**

No password reset flow (acceptable — MVP, demo accounts are available for casual exploration). No email verification (acceptable — virtual money, no fraud risk). No 2FA. No admin panel. No multi-currency (USD only). No real money. No KYC. No market depth / order book / limit orders / stop loss. No social features. No mobile native apps.

## Testing Decisions

**Philosophy**

A good test verifies external behaviour of a module through its public interface, not implementation details. Tests should survive reasonable refactors — if a helper function is extracted or an internal variable renamed, the test should still pass. Tests fail only when actual behaviour diverges from contract. Avoid mocking what you don't own; prefer fakes for internal collaborators (e.g. an in-memory repository) over mocks of methods.

**Modules under test in MVP**

Order Module — the core business-logic module. Tests cover: successful buy debits balance and creates/updates Holding with correct VWAP; successful sell credits balance and reduces Holding; sell of full quantity removes Holding; insufficient balance rejects buy with correct reason; insufficient holding rejects sell; concurrent orders for the same user serialise correctly (two simultaneous buys don't double-spend); Transaction row is always written iff Order is FILLED; Order is never left PENDING after `placeOrder` returns. Tests run against a real Postgres in a Testcontainers instance — this is the right level because the transactional guarantees we care about live in the database, and mocking Prisma would test the mock instead of the behaviour. Quote source is faked via an injectable interface.

Portfolio Module — pure valuation logic. Tests cover: empty portfolio valuates to balance only; single holding valuates correctly; multi-holding sums correctly; P/L absolute and percentage are computed against average buy price; valuation uses decimal arithmetic (no float drift on edge values like 0.1 + 0.2); missing Quote for an Asset is handled deterministically (returns partial valuation flagged as stale). Pure functions, no I/O, plain vitest.

**Prior art / patterns to follow**

This is a greenfield repository so there's no in-repo prior art. External references the project will follow: NestJS official docs on testing modules with `Test.createTestingModule`, Prisma docs on testing with Testcontainers, vitest documentation on test isolation. The first written test (a Portfolio valuation test) becomes the prior-art template for everything that follows — keep it short, descriptive name, arrange/act/assert structure, no shared mutable state between tests.

**Not under test in MVP**

Auth Module, Pricing Module, Market Data Gateway, Web App. Manual E2E walkthroughs cover happy-paths during development. A single Playwright smoke test (register → login → place order → see transaction) runs in CI as a sanity check but isn't treated as the primary test surface. Comprehensive testing of these modules is explicitly deferred to a Phase 2 PRD.

## Out of Scope

Real money, real exchange integration, real order execution. Limit orders, stop orders, market depth, order book, partial fills, slippage modelling. Multi-currency support, FX, fiat on/off-ramp. KYC, AML, identity verification, regulatory compliance. Email verification, password reset, 2FA, OAuth login. Admin panel, user management UI, support tooling. Social features (following users, copying trades, leaderboards). Mobile native apps (iOS/Android). Multi-region deployment, high availability, multi-AZ. Kubernetes, ECS, RDS, S3, CloudFront, Lambda. Microservices split. Separate worker service. Kafka, SQS, SNS. Sentry, Datadog, New Relic — basic pino logs to file are sufficient for MVP. Internationalisation, multi-language UI. Accessibility audit beyond keyboard-navigable forms. Load testing, chaos engineering. Detailed observability (metrics dashboards, distributed tracing).

## Further Notes

**Cost projection**

Months 1–12: ≈ £0.10/mo (just the domain registration; AWS Free Tier covers compute, storage, and bandwidth).

Months 13+: ≈ £6.70/mo on-demand, or ≈ £4.90/mo with a 1-year Compute Savings Plan on t4g.micro. The decision to commit to a Savings Plan is deferred to month 11 — by then the project's continued operation will be evaluated against actual usage and value delivered.

Hard ceiling: £8/mo via AWS Budgets alert. If breached, first action is to investigate (likely a runaway log file or accidental snapshot retention); second action is to migrate to Hetzner CX22 at ≈ £3.20/mo.

**Phasing inside the MVP**

Week 1: Monorepo skeleton, EC2 provisioned, docker-compose runs locally, both apps return health checks.

Week 2: Auth + Prisma schema + migrations + seed. Login works end-to-end locally.

Week 3: Production deploy live with HTTPS. CI/CD green. The platform is publicly reachable.

Week 4: Pricing Module + WebSocket Gateway. Live BTCUSDT quote visible on a debug page.

Week 5: Order Module + Portfolio Module + tests for both. The PRD's testing scope is satisfied.

Week 6: Dashboard UI, chart, trade form. End-to-end product is usable.

Week 7: BullMQ for async portfolio recompute, daily Postgres backup, basic rate limiting on `POST /orders` and auth endpoints.

Week 8: Documentation polish, architecture diagram, demo-account seeding. Phase 2 backlog triaged into separate issues.

**Risks & mitigations**

t4g.micro RAM exhaustion under load: mitigated by 2GB swap and container memory limits in docker-compose (api 256MB, web 256MB, postgres 384MB, redis 64MB, nginx 64MB — leaves headroom).

Binance WebSocket disconnects: mitigated with exponential backoff reconnect inside Pricing Module. Last known Quote stays in Redis with a TTL so stale data is detectable.

Race conditions on Order placement: mitigated by `SELECT ... FOR UPDATE` on the User row inside the transaction. Tested explicitly.

Cost overrun: mitigated by AWS Budgets alarm and the fallback Hetzner migration plan. ghcr.io egress is not metered; AWS-side egress is capped by Free Tier 100GB/mo (realistic usage <5GB).

Scope creep: mitigated by a strict rule that anything not in this PRD goes into a new issue, not into the current branch.

**Definition of Done for MVP**

A public HTTPS URL serves the full application. Two demo accounts exist with pre-seeded transactions and realistic P/L history. Register, login, place-order, and portfolio-view flows work end-to-end without errors. CI is green on main. Tests cover the Order Module and Portfolio Module per the testing section. README contains an architecture diagram, screenshots, local setup instructions, deployment overview, and cost breakdown. The platform operates within the £5/month soft budget.
