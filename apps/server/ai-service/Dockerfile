# Stage 1: Build (requires workspace root as build context)
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./.npmrc
COPY packages ./packages
COPY apps/server/ai-service ./apps/server/ai-service

RUN pnpm config set store-dir /root/.local/share/pnpm/store
RUN pnpm install --filter @platform/ai-service...
RUN pnpm --filter @platform/ai-service... run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/apps/server/ai-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3002
CMD ["node", "dist/main.js"]

