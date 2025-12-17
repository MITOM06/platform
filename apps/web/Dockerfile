FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable

# Copy workspace (root context)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps ./apps
COPY packages ./packages

# Install toàn workspace (đơn giản nhất, ít lỗi)
RUN pnpm install --frozen-lockfile

# Build đúng web package (không chạy pnpm build ở root)
RUN pnpm -C apps/web run build

EXPOSE 3000
CMD ["pnpm", "-C", "apps/web", "start"]
