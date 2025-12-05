FROM node:20-alpine

# 0) Cài thêm tool để build các package có native addon (bcrypt, sharp, v.v.)
RUN apk add --no-cache libc6-compat python3 make g++

# 1) Pin phiên bản pnpm khớp local (nếu bạn dùng pnpm 9.15.9)
ARG PNPM_VERSION=9.15.9
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# 2) Chọn thư mục làm việc trong container
WORKDIR /app

# 3) Copy package.json vào trước để tận dụng cache
COPY package.json ./

# 4) Cài dependencies
# (KHÔNG dùng --frozen-lockfile vì trong apps/server không có pnpm-lock.yaml riêng)
RUN pnpm install

# 5) Copy toàn bộ source code server vào container
COPY . .

# 6) Build NestJS
RUN pnpm build

# 7) Cấu hình runtime
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
