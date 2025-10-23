FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm i --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm","run","start"]
