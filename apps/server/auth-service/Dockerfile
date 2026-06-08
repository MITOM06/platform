FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY packages/database/package.json ./packages/database/
COPY apps/server/auth-service/package.json ./apps/server/auth-service/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/server/auth-service ./apps/server/auth-service

RUN pnpm --filter @platform/database build 2>/dev/null || true
RUN pnpm --filter @platform/auth-service build

RUN pnpm --filter @platform/auth-service deploy --prod /deploy

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /deploy ./
COPY --from=builder /app/apps/server/auth-service/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
