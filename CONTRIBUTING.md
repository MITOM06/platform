# Contributing

## Setup nhanh
- Node 20 + pnpm
- `pnpm i`
- `cp apps/server/.env.sample apps/server/.env && cp apps/web/.env.sample apps/web/.env`
- `docker compose -f infra/docker/docker-compose.yml up -d`

## Quy trình
- Nhánh tính năng: `feat/<scope>`, fix: `fix/<scope>`
- Commit: Conventional Commits (feat:, fix:, chore:, docs:, ci:, refactor:, test:)
- PR vào `main`: cần CI xanh (lint/build/test)

## Code style
- TypeScript strict, không disable eslint bừa
- Server: NestJS module hoá; Web: Next.js App Router
