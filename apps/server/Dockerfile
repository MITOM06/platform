FROM node:20-alpine
WORKDIR /app
RUN corepack enable

# Copy những file workspace cần thiết
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./.npmrc

# Copy workspace source (PHẢI có infra)
COPY apps ./apps
COPY packages ./packages
COPY infra ./infra

# Install toàn workspace
RUN pnpm install --frozen-lockfile

# Build infra redis để có dist types + js
RUN pnpm -C infra/redis run build


# Build server (tạo dist/main.js)
RUN pnpm -C apps/server run build

WORKDIR /app/apps/server
EXPOSE 4000
CMD ["node", "dist/main.js"]

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY .npmrc ./.npmrc
