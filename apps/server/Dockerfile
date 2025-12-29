FROM node:20-alpine
WORKDIR /app

RUN corepack enable

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY .npmrc ./.npmrc

# Copy workspace source
COPY apps ./apps
COPY packages ./packages
COPY infra ./infra

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared infra
RUN pnpm -C infra/redis run build

# Build server → sinh dist/main.js
RUN pnpm -C apps/server run build

WORKDIR /app/apps/server
EXPOSE 4000

CMD ["node", "dist/main.js"]
