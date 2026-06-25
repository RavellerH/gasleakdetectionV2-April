FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/ru-frontend/package.json ./apps/ru-frontend/

RUN npm install

COPY apps/ru-frontend ./apps/ru-frontend
WORKDIR /app/apps/ru-frontend

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/ru-frontend/.next ./.next
COPY --from=builder /app/apps/ru-frontend/public ./public
COPY --from=builder /app/apps/ru-frontend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]

