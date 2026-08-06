FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/ru-frontend/package.json ./apps/ru-frontend/
COPY apps/gateway/package.json ./apps/gateway/

RUN npm ci

COPY apps/gateway ./apps/gateway
WORKDIR /app/apps/gateway
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4100

COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/apps/gateway/generated ./generated
COPY --from=builder /app/apps/gateway/prisma ./prisma
COPY --from=builder /app/apps/gateway/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4100

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && npm run prisma:seed && node dist/main.js"]
