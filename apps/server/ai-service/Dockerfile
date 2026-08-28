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

# ---- prod dependencies only -------------------------------------------------
# The builder above needs devDependencies (typescript, nest CLI) to compile, so
# its node_modules cannot ship. Resolve a second, production-only tree instead:
# `pnpm install` resolves the whole workspace, and copying that dragged every
# other package's deps into this image -- each backend carried the web app's
# Next.js (170MB) and Firebase (97MB) for nothing.
#
# NOT `pnpm deploy`: it re-resolves version ranges instead of reading the
# lockfile. It silently upgraded @nestjs-modules/mailer 2.0.2 -> 2.3.7, whose
# new "exports" map blocks the deep import the bundle performs -- a smaller
# image that crashes on boot. --frozen-lockfile pins what the lockfile says.
FROM node:20-alpine AS proddeps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY packages/database/package.json ./packages/database/
COPY apps/server/ai-service/package.json ./apps/server/ai-service/
RUN pnpm install --frozen-lockfile --prod --filter @platform/ai-service...

FROM node:20-alpine
WORKDIR /app

# Preserve the monorepo directory depth so the compiled relative require in
# app.module.js (`../../../../packages/database/dist`) still resolves at runtime.
# The build emits that path relative to apps/server/ai-service/dist; flattening
# it to /app/dist would make it point at the nonexistent /packages/database/dist
# → MODULE_NOT_FOUND → exit(1) before the port opens.
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/apps/server/ai-service/dist ./apps/server/ai-service/dist

EXPOSE 3002
CMD ["node", "apps/server/ai-service/dist/main.js"]
