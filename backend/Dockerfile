# ---- сборка ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json yarn.lock .yarnrc .npmrc ./
RUN test "$(yarn --version)" = "1.22.22" && yarn install --frozen-lockfile --non-interactive

COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma.config.ts читает env('DATABASE_URL') сразу при загрузке, поэтому на
# сборке подставляем заглушку: подключения тут не происходит, генератору нужна
# только схема
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build yarn prisma generate

COPY . .
RUN yarn build

# ---- прод ----
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock .yarnrc .npmrc ./
# CLI нужен только build-стадии и отдельному сервису миграций.
RUN test "$(yarn --version)" = "1.22.22" && yarn install --frozen-lockfile --production=true --non-interactive \
    && rm -rf node_modules/prisma node_modules/@prisma/dev node_modules/@prisma/config \
    && yarn cache clean

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
