FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./.npmrc

COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile

RUN pnpm -C apps/web run build

EXPOSE 3000

CMD ["pnpm", "-C", "apps/web", "start"]
