# ---- сборка статики ----
FROM node:22-alpine AS build

WORKDIR /app

# Vite «запекает» переменные окружения в бандл на этапе сборки, поэтому адреса
# приходят аргументами сборки, а не переменными контейнера.
# За одним доменом: REST на /api, сокет на тот же origin (пустая строка).
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- раздача ----
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
# Конфиг монтируется из deploy/nginx, чтобы менять его без пересборки образа

EXPOSE 80
