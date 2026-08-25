FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY packages/database/package.json ./packages/database/
COPY apps/server/auth-service/package.json ./apps/server/auth-service/

# Install exact versions from lockfile
RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/server/auth-service ./apps/server/auth-service

RUN pnpm --filter @platform/database build 2>/dev/null || true
RUN pnpm --filter @platform/auth-service build

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
COPY apps/server/auth-service/package.json ./apps/server/auth-service/
RUN pnpm install --frozen-lockfile --prod --filter @platform/auth-service...

FROM node:20-alpine
WORKDIR /app

# Copy node_modules from lockfile-installed workspace (exact versions)
COPY --from=proddeps /app/node_modules ./node_modules
# Copy @platform/database so workspace symlinks resolve
COPY --from=builder /app/packages/database ./packages/database
# Copy built dist
COPY --from=builder /app/apps/server/auth-service/dist ./dist

EXPOSE 3001
CMD ["node", "dist/main.js"]
