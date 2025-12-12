# Stage 1: Cài dependency
FROM node:20-alpine AS deps
WORKDIR /app

# Copy file khai báo dependency của web
COPY package.json pnpm-lock.yaml* ./

# Bật corepack + cài dependency
RUN corepack enable && pnpm install --no-frozen-lockfile

# Stage 2: Chạy app (dev hoặc build)
FROM node:20-alpine
WORKDIR /app

# Copy node_modules từ stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source code web vào container
COPY . .

EXPOSE 3000

# Tuỳ mục tiêu:
# - Nếu đang phát triển: dùng "dev"
# - Nếu đã build prod: dùng "start" (cần thêm lệnh build)
CMD ["pnpm", "dev"]
