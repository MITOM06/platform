FROM node:20-alpine

# 0) Cài thêm tool để build các package có native addon (bcrypt, sharp, v.v.)
RUN apk add --no-cache libc6-compat python3 make g++

# 1) Giữ lại corepack + pin phiên bản pnpm
ARG PNPM_VERSION=9.15.9

# (tuỳ chọn) giảm strict mode để corepack dễ thở hơn
ENV COREPACK_ENABLE_STRICT=0

# 2) Bật corepack, rồi *cố gắng* prepare pnpm.
#    Nếu corepack bị lỗi HTTP 500 khi tải pnpm, ta fallback sang npm install -g pnpm.
RUN corepack enable || true \
 && (corepack prepare pnpm@${PNPM_VERSION} --activate || npm install -g pnpm@${PNPM_VERSION})

# 3) Chọn thư mục làm việc trong container
WORKDIR /app

# 4) Copy package.json (và pnpm-lock.yaml nếu có) để tận dụng cache
COPY package.json ./
# nếu bạn có pnpm-lock.yaml ở apps/server thì nên thêm:
# COPY pnpm-lock.yaml ./

# 5) Cài dependencies bằng pnpm (dùng pnpm do corepack chuẩn bị,
#    hoặc dùng bản pnpm đã cài bằng npm nếu corepack failed)
RUN pnpm install

# 6) Copy toàn bộ source code server vào container
COPY . .

# 7) Build NestJS
RUN pnpm build

# 8) Cấu hình runtime
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/main.js"]
