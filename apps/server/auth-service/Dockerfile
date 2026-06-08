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

FROM node:20-alpine
WORKDIR /app

# Copy node_modules from lockfile-installed workspace (exact versions)
COPY --from=builder /app/node_modules ./node_modules
# Copy @platform/database so workspace symlinks resolve
COPY --from=builder /app/packages/database ./packages/database
# Copy built dist
COPY --from=builder /app/apps/server/auth-service/dist ./dist

EXPOSE 3001
CMD ["node", "dist/main.js"]
