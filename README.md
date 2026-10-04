# Favorite

Кино-дневник: своя коллекция фильмов и сериалов с оценками и статусами просмотра,
списки, друзья, чат и «Топ». Интерфейс на русском.

| Часть | Стек | Где |
|---|---|---|
| Фронтенд | Vue 3 (`<script setup>`), Pinia, Vue Router, Ant Design Vue 4, Vite, PWA | [frontend/](frontend/) |
| Бэкенд | NestJS, Prisma 7, Postgres, JWT + httpOnly refresh-кука, Socket.IO (чат) | [backend/](backend/) |
| Развёртывание | Docker Compose, nginx, Let's Encrypt | [deploy/](deploy/) |

## Локальный запуск

Нужны Node 22 и Docker.

```bash
# 1. база (отдельного compose для разработки нет — контейнер поднимается вручную)
docker run -d --name postgres -p 5433:5432 -v favorite-pg:/var/lib/postgresql \
  -e POSTGRES_USER=root -e POSTGRES_PASSWORD=123456 -e POSTGRES_DB=favorites \
  postgres:18-alpine

# 2. бэкенд → http://localhost:3005, Swagger на /docs
cd backend && npm install && npx prisma migrate deploy && npm run start:dev

# 3. фронтенд → http://localhost:8080
cd frontend && npm install && npm run dev
```

`frontend/.env` лежит в репозитории, а `backend/.env` — нет (в нём секреты). Создайте его:

```env
NODE_ENV=development
COOKIE_DOMAIN=localhost
JWT_SECRET=<любая строка>
JWT_ACCESS_TOKEN_TTL=2h
JWT_REFRESH_TOKEN_TTL=7d
DATABASE_URL=postgresql://root:123456@localhost:5433/favorites
```

Все шесть переменных обязательны: бэкенд читает их через `getOrThrow` и без любой
из них не стартует.

⚠️ **`prisma migrate dev` и любой reset запускать нельзя.** У таблицы `movies`
давнее расхождение схемы, и Prisma в ответ требует пересоздать базу — это потеря
данных. Новые изменения применяются неразрушающе:
`npx prisma db execute --file <sql>` + `npx prisma migrate resolve --applied <имя>`.

## Проверки перед сдачей работы

```bash
cd frontend && npx eslint "src/**/*.{ts,vue}" && npx vitest run && npm run build
cd backend  && npx nest build
```

Типы на сборке фронтенда **не проверяются**: `npm run build` — это только
`vite build`, `vue-tsc` в проекте нет.

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
