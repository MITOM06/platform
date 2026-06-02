# Contributing

## Quick Setup

**Prerequisites:** Docker, Node.js ≥ 20, pnpm (`corepack enable`), Flutter SDK 3.x, Java 21 + Maven.

```bash
git clone https://github.com/MITOM06/platform.git && cd platform
pnpm install
cp apps/server/auth-service/.env.example apps/server/auth-service/.env
# fill in JWT_ACCESS_SECRET and mail credentials
docker compose -f infra/docker-compose/compose.yml up -d
```

Flutter client:
```bash
cd apps/client && flutter pub get && flutter run
```

## Workflow

- **Feature branch:** `feat/<scope>` — e.g. `feat/message-reactions`
- **Bug fix branch:** `fix/<scope>`
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`
- **PRs** target `main`. CI must be green (lint / build / test) before merge.

## Code Style

**Flutter (client)**
- Feature-based layout: `lib/features/<name>/{data,domain,ui}/`
- Riverpod for all state — no `setState` in feature screens
- Every UI string via `context.l10n.<key>` — no hardcoded text
- `flutter analyze` must report 0 issues; `flutter test` must pass

**Spring Boot (chat-service)**
- Constructor injection + `@RequiredArgsConstructor` — no `@Autowired` on fields
- `jakarta.*` imports only — never `javax.*`
- DTOs for all API responses — never expose `@Document` entities directly
- `mvn test` must pass before opening a PR

**NestJS (auth-service)**
- TypeScript strict mode; no `eslint-disable` without justification
- NestJS module structure; services injected via constructor

## File-length Limits

| Layer | Max lines |
|-------|-----------|
| Flutter UI screen / widget | 400 |
| Spring Boot service / controller | 500 |

Files exceeding these limits must be split before merging.

## Running Tests

```bash
# Backend
cd apps/server/chat-service && mvn test

# Flutter
cd apps/client && flutter test
cd apps/client && flutter analyze
```
