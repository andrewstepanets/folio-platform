# folio-platform

Virtual cryptocurrency portfolio simulator using live market data.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18.17.1 (see `.nvmrc`) |
| pnpm | ≥ 9 |
| Docker | ≥ 20 |

## Quick start

```bash
# Install dependencies
pnpm install

# Start all services (web, api, postgres, redis)
docker compose -f infra/docker/docker-compose.dev.yml up --build

# Verify API health
curl http://localhost:3001/health
# → { "status": "ok", "commit": "dev" }

# Open web app
open http://localhost:3000
```

## Repository structure

```
apps/
  api/       NestJS API (port 3001)
  web/       Next.js App Router (port 3000)
packages/
  shared/    Zod schemas shared between apps
  database/  Prisma schema and migrations
  eslint-config/  Shared ESLint rules
infra/
  docker/    docker-compose files
```

## Development commands

```bash
pnpm typecheck   # TypeScript strict check across all packages
pnpm lint        # ESLint across all packages
pnpm build       # Build all packages
```
