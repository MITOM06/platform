# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install the full workspace (web depends on @platform/database etc.) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Same linker settings as local dev, CI and the backend images (node-linker=hoisted).
# Without .npmrc pnpm used its isolated layout, which puts the web app's packages
# (and the `next` binary) under apps/web/node_modules — which the build stage never
# copied, so the self-host image failed with "next: not found".
COPY .npmrc* ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @platform/web... || pnpm install --filter @platform/web...

# ---- build ----
FROM base AS build
# The whole installed tree (root + per-package node_modules), then the sources on
# top; .dockerignore keeps the host's node_modules out of `COPY . .`.
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @platform/web build

# ---- run: Next.js standalone server ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
