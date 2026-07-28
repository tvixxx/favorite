#!/usr/bin/env bash
# Первичная настройка сервера под Favorite. Запускать на чистом Ubuntu 22.04/24.04
# от root (или через sudo). Идемпотентен: повторный запуск ничего не ломает.
#
#   ./bootstrap.sh            # всё по порядку: пакеты → firewall → сборка → старт
#   ./bootstrap.sh certs      # только получить/обновить сертификат Let's Encrypt
#   ./bootstrap.sh cron       # только поставить бэкапы в cron
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

if [[ ! -f .env ]]; then
  echo "Нет deploy/.env — скопируйте .env.example и заполните." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${DOMAIN:?укажите DOMAIN в .env}"
: "${POSTGRES_PASSWORD:?укажите POSTGRES_PASSWORD в .env}"
: "${JWT_SECRET:?укажите JWT_SECRET в .env}"
DATA_DIR="${DATA_DIR:-/srv/favorite/data}"
BACKUP_DIR="${BACKUP_DIR:-/srv/favorite/backups}"

step() { printf "\n\033[1m==> %s\033[0m\n" "$1"; }

install_packages() {
  step "Пакеты: docker, node, вспомогательное"

  if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
  fi

  # Node на хосте нужен для скриптов бэкапа (они дергают pg_dump внутри контейнера,
  # поэтому версия клиента всегда совпадает с сервером)
  if ! command -v node >/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi

  apt-get install -y ufw gettext-base gnupg
}

setup_firewall() {
  step "Firewall: только SSH и веб"
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
}

prepare_dirs() {
  step "Каталоги данных"
  mkdir -p "$DATA_DIR/postgres" "$DATA_DIR/certbot/conf" "$DATA_DIR/certbot/www" "$BACKUP_DIR"
}

start_stack() {
  step "Сборка и запуск (HTTP)"
  docker compose up -d --build
  docker compose ps
}

run_migrations() {
  step "Миграции Prisma"
  docker compose exec -T backend npx prisma migrate deploy
}

obtain_certs() {
  step "Сертификат Let's Encrypt для $DOMAIN"

  # Проверка ACME идёт через тот же nginx: он уже отдаёт /.well-known/acme-challenge
  docker run --rm \
    -v "$DATA_DIR/certbot/conf:/etc/letsencrypt" \
    -v "$DATA_DIR/certbot/www:/var/www/certbot" \
    certbot/certbot certonly --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "${LETSENCRYPT_EMAIL:-admin@$DOMAIN}" \
    --agree-tos --no-eff-email --non-interactive

  step "Переключаю nginx на HTTPS"
  envsubst '${DOMAIN}' < nginx/app-ssl.conf > nginx/app-ssl.generated.conf

  # Меняем монтирование конфига на сгенерированный HTTPS-вариант
  if ! grep -q "app-ssl.generated.conf" docker-compose.yml; then
    sed -i 's|./nginx/app.conf:/etc/nginx/conf.d/default.conf|./nginx/app-ssl.generated.conf:/etc/nginx/conf.d/default.conf|' docker-compose.yml
  fi

  docker compose up -d web
  echo "Готово: https://$DOMAIN"
}

setup_cron() {
  step "Бэкапы в cron (каждый час) и продление сертификата (раз в неделю)"

  local backup_cmd="cd $DEPLOY_DIR/../backend && PG_CONTAINER=${PG_CONTAINER:-favorite-postgres} BACKUP_DIR=$BACKUP_DIR PG_USER=$POSTGRES_USER PG_DB=$POSTGRES_DB S3_URI=${S3_URI:-} GPG_RECIPIENT=${GPG_RECIPIENT:-} HEALTHCHECK_URL=${HEALTHCHECK_URL:-} /usr/bin/node scripts/backup/db-backup.cjs >> /var/log/favorite-backup.log 2>&1"
  local renew_cmd="docker run --rm -v $DATA_DIR/certbot/conf:/etc/letsencrypt -v $DATA_DIR/certbot/www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker exec favorite-web nginx -s reload"

  # Пишем в отдельный файл, чтобы не затирать чужие задания
  cat > /etc/cron.d/favorite <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 * * * * root $backup_cmd
30 3 * * 1 root $renew_cmd >> /var/log/favorite-certbot.log 2>&1
CRON

  chmod 0644 /etc/cron.d/favorite
  echo "Задания записаны в /etc/cron.d/favorite"
}

case "${1:-all}" in
  certs) obtain_certs ;;
  cron) setup_cron ;;
  all)
    install_packages
    setup_firewall
    prepare_dirs
    start_stack
    run_migrations
    echo
    echo "Стек поднят по HTTP. Дальше:"
    echo "  1) проверьте http://$DOMAIN"
    echo "  2) ./bootstrap.sh certs   — получить сертификат и включить HTTPS"
    echo "  3) ./bootstrap.sh cron    — поставить бэкапы в расписание"
    ;;
  *)
    echo "Неизвестная команда: $1 (ожидается all | certs | cron)" >&2
    exit 1
    ;;
esac
