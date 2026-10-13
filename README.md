# Favorite

Кино-дневник: своя коллекция фильмов и сериалов с оценками и статусами просмотра,
списки, друзья, чат и «Топ». Интерфейс на русском.

| Часть | Стек | Где |
|---|---|---|
| Фронтенд | Vue 3 (`<script setup>`), Pinia, Vue Router, Ant Design Vue 4, Vite, PWA | [frontend/](frontend/) |
| Бэкенд | NestJS, Prisma 7, Postgres, JWT + httpOnly refresh-кука, Socket.IO (чат) | [backend/](backend/) |
| Развёртывание | Docker Compose, nginx, Let's Encrypt | [deploy/](deploy/) |

## Локальный запуск

Нужны Node 22, Yarn Classic 1.22.22 и Docker. В обоих приложениях используем Yarn и `yarn.lock`. Проектные `.npmrc`/`.yarnrc` задают публичный registry, корпоративный VPN не требуется.

```bash
# 1. база (отдельного compose для разработки нет — контейнер поднимается вручную)
docker run -d --name postgres -p 5433:5432 -v favorite-pg:/var/lib/postgresql \
  -e POSTGRES_USER=root -e POSTGRES_PASSWORD=123456 -e POSTGRES_DB=favorites \
  postgres:18-alpine

# 2. бэкенд → http://localhost:3005, Swagger на /docs
cd backend
yarn install --frozen-lockfile
yarn prisma generate
yarn prisma migrate deploy
yarn start:dev

# 3. фронтенд → http://localhost:8080
cd frontend
yarn install --frozen-lockfile
yarn dev
```

Команды frontend запускаются из корня репозитория в отдельном терминале. `backend/.env` создайте самостоятельно, не добавляйте его в Git:

```env
NODE_ENV=development
COOKIE_DOMAIN=localhost
JWT_SECRET=<любая строка>
JWT_ACCESS_TOKEN_TTL=2h
JWT_REFRESH_TOKEN_TTL=7d
DATABASE_URL=postgresql://root:123456@localhost:5433/favorites
```

Контракт дополнительных настроек, медиа и production описан в [deploy/README.md](deploy/README.md). Значения выше предназначены только для локальной разработки.

**Не запускать reset для базы с данными.** У старой локальной базы было расхождение схемы `movies` с историей миграций. Обычный путь — `yarn prisma migrate deploy`. Если история существующей базы расходится, сначала проверить её состояние и применённый SQL. `yarn prisma migrate resolve --applied <имя>` допустим только после проверки, что весь SQL этой миграции действительно выполнен.

## Проверки перед сдачей работы

```bash
cd frontend && yarn lint && yarn test:unit --run && yarn build
cd backend && yarn lint:check && yarn test --runInBand && yarn build
```

Каждая строка выше запускается из корня проекта. `yarn build` фронтенда сначала проверяет типы через `vue-tsc` и `tsc`, затем собирает Vite/PWA. Для изолированной проверки Docker/nginx: `bash deploy/verify-local.sh`.

## Дизайн-система

Свои токены с префиксом `--fv-` в три слоя: палитра → семантика → компоненты.
Компоненты используют **только** семантические токены, иначе ломаются 7 тем.
Определения — в `frontend/src/styles/` (`theme-variables.scss`, `tokens.scss`,
`fonts.scss`), переключение тем — `composable/useTheme.ts`.

Из шрифтов доступны начертания только 400/500/700 — вес 600 браузер подменяет
на 700, и текст выглядит перетяжелённым.

## Развёртывание и данные

- [deploy/README.md](deploy/README.md) — пошаговое развёртывание на Timeweb Cloud:
  один домен на всё, HTTPS, cron. Первый деплой — четыре команды.
- [backend/scripts/backup/README.md](backend/scripts/backup/README.md) — периодические
  слепки базы: снятие, проверка восстановления, откат. В дампе персональные данные,
  поэтому шифрование и копия вне сервера обязательны.

Демо-данные для проверки постраничной загрузки: `node backend/scripts/seed-demo-movies.cjs`
(удаление — с флагом `--remove`). На продакшене не запускать.
