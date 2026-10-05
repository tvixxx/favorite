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
# npm сохраняет optional peer Prisma CLI даже при omit=dev. Runtime использует
# скомпилированный клиент, миграции запускаются из отдельной build-стадии.
RUN npm ci --omit=dev && rm -rf node_modules/prisma node_modules/@prisma/dev node_modules/@prisma/config

# Сгенерированный клиент лежит в src/generated/prisma и целиком состоит из .ts,
# поэтому попадает в dist при сборке — отдельно копировать нечего
COPY --from=build /app/dist ./dist

# PORT задаётся в Compose, 3005 используется по умолчанию. Порт не публикуем,
# доступ идёт только через nginx внутри docker-сети
EXPOSE 3005
USER node

# В корне бэкенда есть prisma.config.ts, из-за него tsc сохраняет в выводе
# папку src/ — точка входа именно dist/src/main.js, а не dist/main.js
CMD ["node", "dist/src/main.js"]
