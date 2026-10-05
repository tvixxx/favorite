#!/usr/bin/env bash
# Общие настройки. Секреты загружаются только на сервере, без вывода значений.
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"
if [[ ! -f .env ]]; then
  echo "Создайте deploy/.env по инструкции в README.md." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a
: "${DOMAIN:?Укажите DOMAIN}"
: "${POSTGRES_USER:?Укажите POSTGRES_USER}"
: "${POSTGRES_DB:?Укажите POSTGRES_DB}"
: "${POSTGRES_PASSWORD:?Укажите POSTGRES_PASSWORD}"
: "${JWT_SECRET:?Укажите JWT_SECRET}"
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$ ]]; then
  echo "DOMAIN должен содержать имя домена без схемы и пути." >&2
  exit 1
fi
# Эти значения входят в PostgreSQL URI. Спецсимволы требуют отдельного кодирования.
if [[ ! "$POSTGRES_USER" =~ ^[a-zA-Z0-9_]+$ || ! "$POSTGRES_DB" =~ ^[a-zA-Z0-9_]+$ || ! "$POSTGRES_PASSWORD" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "Для пользователя, базы и пароля используйте A-Z, a-z, 0-9, _ и -. Пароль: openssl rand -hex 32." >&2
  exit 1
fi
export DATA_DIR="${DATA_DIR:-/srv/favorite/data}"
export BACKUP_DIR="${BACKUP_DIR:-/srv/favorite/backups}"
export NGINX_CONFIG="$DEPLOY_DIR/nginx/app.conf"
if [[ -f "$DEPLOY_DIR/.state/nginx-ssl.conf" ]]; then
  export NGINX_CONFIG="$DEPLOY_DIR/.state/nginx-ssl.conf"
fi
step() { printf '\n==> %s\n' "$1"; }
require_media_config() {
  : "${MEDIA_PUBLIC_BASE_URL:?Укажите HTTPS-адрес изображений}"
  : "${MEDIA_S3_ENDPOINT:?Укажите MEDIA_S3_ENDPOINT}"
  : "${MEDIA_S3_BUCKET:?Укажите MEDIA_S3_BUCKET}"
  : "${MEDIA_S3_ACCESS_KEY:?Укажите MEDIA_S3_ACCESS_KEY}"
  : "${MEDIA_S3_SECRET_KEY:?Укажите MEDIA_S3_SECRET_KEY}"
}
start_application() {
  step "Миграции до запуска новой версии API"
  docker compose run --rm --no-deps migrate
  step "Запуск и ожидание готовности"
  docker compose up -d --wait --wait-timeout 120 backend
  # nginx должен заново разрешить адрес пересозданного backend-контейнера.
  docker compose up -d --force-recreate web
  docker compose exec -T web nginx -t
}
check_application() {
  local origin="http://127.0.0.1"
  if [[ "$NGINX_CONFIG" == */.state/nginx-ssl.conf ]]; then
    origin="https://$DOMAIN"
  fi
  # Проверка тела не принимает SPA вместо API.
  curl --fail --silent --show-error --max-time 15 "$origin/api/health" \
    | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{if(JSON.parse(s).status!=="ok")process.exit(1)}catch{process.exit(1)}})'
  curl --fail --silent --show-error --max-time 15 "$origin/" -o /dev/null
  echo "API, база и веб отвечают корректно."
}
