FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY packages/database/package.json ./packages/database/
COPY apps/server/ai-service/package.json ./apps/server/ai-service/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/server/ai-service ./apps/server/ai-service

# @platform/ai-service compiles against @platform/database's built declarations
# (tsconfig.build.json maps the import to packages/database/dist), so this build
# must succeed before the ai-service build — do NOT swallow its failures.
RUN pnpm --filter @platform/database build
RUN pnpm --filter @platform/ai-service build

FROM node:20-alpine
WORKDIR /app

# Preserve the monorepo directory depth so the compiled relative require in
# app.module.js (`../../../../packages/database/dist`) still resolves at runtime.
# The build emits that path relative to apps/server/ai-service/dist; flattening
# it to /app/dist would make it point at the nonexistent /packages/database/dist
# → MODULE_NOT_FOUND → exit(1) before the port opens.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
# @platform/database is consumed as its prebuilt dist; its own node_modules holds a
# SECOND copy of @nestjs/* (declared as regular deps). A duplicate @nestjs/core means
# the Reflector class the shared guards (RequirePermissionGuard/JwtAuthGuard) import is
# a different class than the one this app's Nest container provides → DI fails to
# resolve the guard's dependency at index 0 → exit(1) before the port opens. Drop it so
# the guards resolve @nestjs/core from the single root node_modules (verified: all of
# database's runtime deps still resolve there).
RUN rm -rf packages/database/node_modules
COPY --from=builder /app/apps/server/ai-service/dist ./apps/server/ai-service/dist

EXPOSE 3002
CMD ["node", "apps/server/ai-service/dist/main.js"]
