# Stage 1: Build (requires workspace root as build context)
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./.npmrc
COPY packages ./packages
COPY apps/server/auth-service ./apps/server/auth-service

RUN pnpm config set store-dir /root/.local/share/pnpm/store
RUN pnpm install --filter @platform/auth-service...
RUN pnpm --filter @platform/auth-service... run build

# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/apps/server/auth-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3001
CMD ["node", "dist/main.js"]
