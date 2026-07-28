# ---- сборка ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma.config.ts читает env('DATABASE_URL') сразу при загрузке, поэтому на
# сборке подставляем заглушку: подключения тут не происходит, генератору нужна
# только схема
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npx prisma generate

COPY . .
RUN npm run build

# ---- прод ----
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Схема и конфиг нужны в рантайме: их читает `prisma migrate deploy`.
# Конфиг обязателен — в datasource схемы нет url, он берётся из DATABASE_URL
# именно через prisma.config.ts
COPY prisma ./prisma
COPY prisma.config.ts ./

# Сгенерированный клиент лежит в src/generated/prisma и целиком состоит из .ts,
# поэтому попадает в dist при сборке — отдельно копировать нечего
COPY --from=build /app/dist ./dist

# Бэкенд слушает 3005 (значение зашито в src/main.ts) — наружу его не публикуем,
# доступ идёт только через nginx внутри docker-сети
EXPOSE 3005

# В корне бэкенда есть prisma.config.ts, из-за него tsc сохраняет в выводе
# папку src/ — точка входа именно dist/src/main.js, а не dist/main.js
CMD ["node", "dist/src/main.js"]
