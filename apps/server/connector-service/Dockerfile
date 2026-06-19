FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY packages/database/package.json ./packages/database/
COPY apps/server/connector-service/package.json ./apps/server/connector-service/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/server/connector-service ./apps/server/connector-service

RUN pnpm --filter @platform/database build 2>/dev/null || true
RUN pnpm --filter connector-service build

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/apps/server/connector-service/dist ./dist

EXPOSE 3003
CMD ["node", "dist/main.js"]
