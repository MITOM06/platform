Read CLAUDE.md first. We are deploying to Google Cloud Run and auth-service container crashes on startup (TCP probe fails on port 3001). Fix everything needed for all 3 services to run correctly on Cloud Run.

## CONTEXT

- Monorepo: pnpm workspace at root, packages at `packages/database` and `packages/shared`
- auth-service and ai-service are NestJS/TypeScript, depend on `@platform/database` workspace package
- chat-service is Spring Boot 3, standalone (no shared packages)
- Production env vars are injected by Cloud Run (MONGODB_URI, REDIS_URL, JWT_ACCESS_SECRET, etc.)
- Cloud Run injects PORT env var — app must use `process.env.PORT`

## TASK 1 — Fix auth-service Dockerfile for pnpm monorepo

Current Dockerfile copies raw `node_modules` from builder which breaks pnpm workspace symlinks at runtime.
Replace with `pnpm deploy` pattern which creates a self-contained node_modules:

```dockerfile
# apps/server/auth-service/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests first (cache layer)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/ 2>/dev/null || true
COPY apps/server/auth-service/package.json ./apps/server/auth-service/

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages ./packages
COPY apps/server/auth-service ./apps/server/auth-service

# Build workspace packages first, then auth-service
RUN pnpm --filter @platform/database build 2>/dev/null || true
RUN pnpm --filter @platform/auth-service build

# Create self-contained deploy directory (resolves all workspace symlinks)
RUN pnpm --filter @platform/auth-service deploy --prod /deploy

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /deploy ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

Check if `packages/database` has a `build` script in its package.json. If not, add: `"build": "tsc -p tsconfig.json"` and ensure it has a `tsconfig.json`. If `packages/shared` does not exist, remove those lines.

## TASK 2 — Fix ai-service Dockerfile (same pnpm monorepo issue)

Apply the same `pnpm deploy` pattern to `apps/server/ai-service/Dockerfile`:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/ 2>/dev/null || true
COPY apps/server/ai-service/package.json ./apps/server/ai-service/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/server/ai-service ./apps/server/ai-service

RUN pnpm --filter @platform/database build 2>/dev/null || true
RUN pnpm --filter @platform/ai-service build

RUN pnpm --filter @platform/ai-service deploy --prod /deploy

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /deploy ./
EXPOSE 3002
CMD ["node", "dist/main.js"]
```

## TASK 3 — Make auth-service startup resilient

The app may crash on startup if optional services (Redis, OAuth providers) fail to initialize.
In `apps/server/auth-service/src/app.module.ts`, check:

1. Redis connection: wrap in try/catch or use `lazyConnect: true` — do NOT crash if Redis is temporarily unavailable at boot
2. OAuth strategies (Google, Facebook, X): if CLIENT_ID env var is empty/undefined, skip registering that strategy instead of throwing. Use optional chaining or guard before PassportModule strategy registration.
3. MongoDB: NestJS mongoose already handles retry — leave as-is.

Check `apps/server/auth-service/src/modules/auth/` for any Passport strategy that reads env vars in constructor without null check. Add guards like:
```typescript
if (!process.env.GOOGLE_CLIENT_ID) {
  // skip strategy registration
  return;
}
```

## TASK 4 — Add health check endpoints

Each NestJS service needs a `/health` endpoint so Cloud Run startup probe has something to hit:

In `apps/server/auth-service/src/app.controller.ts`, add:
```typescript
@Get('health')
health() { return { status: 'ok' }; }
```

Same for `apps/server/ai-service/src/app.controller.ts`.

For chat-service (Spring Boot), check if there's already a `/actuator/health` endpoint via `spring-boot-starter-actuator`. If not present in pom.xml, add:
```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```
And in application.yml add: `management.endpoints.web.exposure.include: health`

## TASK 5 — Verify packages/database has build output

Check `packages/database/package.json`:
- Must have `"main": "dist/index.js"` (or `"exports"`)  
- Must have `"build": "tsc"` script
- Must have `tsconfig.json` that outputs to `dist/`

If `dist/` is gitignored for this package, the pnpm deploy step above will handle building it. Just ensure the build script exists.

## TASK 6 — Verify after changes

Run these commands to verify locally before committing:
```bash
# Test auth-service Docker build (from repo root)
docker build -f apps/server/auth-service/Dockerfile -t auth-test . && echo "AUTH BUILD OK"

# Test ai-service Docker build
docker build -f apps/server/ai-service/Dockerfile -t ai-test . && echo "AI BUILD OK"

# Test chat-service Docker build
docker build -f apps/server/chat-service/Dockerfile -t chat-test apps/server/chat-service/ && echo "CHAT BUILD OK"
```

If any build fails, fix the issue before committing.

## DO NOT

- Do not modify auth-service business logic
- Do not modify any Spring Boot source files beyond adding actuator dependency
- Do not change deploy.yml
- Do not add new dependencies beyond what's needed for the above fixes
