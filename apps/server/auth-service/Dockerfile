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

RUN pnpm config set store-dir /root/.local/share/pnpm/store
# Install dependencies
RUN pnpm install --frozen-lockfile

# Build auth-service → sinh dist/main.js
RUN pnpm -C apps/server/auth-service run build

WORKDIR /app/apps/server/auth-service
EXPOSE 3001

CMD ["node", "dist/main.js"]
