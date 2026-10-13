#!/usr/bin/env bash
# Первичная настройка сервера под Favorite. Запускать на чистом Ubuntu 22.04/24.04
# от root (или через sudo). Идемпотентен: повторный запуск ничего не ломает.
#
#   ./bootstrap.sh            # всё по порядку: пакеты → firewall → сборка → старт
#   ./bootstrap.sh certs      # только получить/обновить сертификат Let's Encrypt
#   ./bootstrap.sh cron       # только поставить бэкапы в cron
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

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
  require_media_config
  step "Сборка образов"
  docker compose build migrate
  docker compose build backend
  docker compose build web
  docker compose up -d --wait --wait-timeout 120 postgres
  start_application
  check_application
  docker compose ps
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
  mkdir -p .state
  envsubst '${DOMAIN}' < nginx/app-ssl.conf > .state/nginx-ssl.conf
  export NGINX_CONFIG="$DEPLOY_DIR/.state/nginx-ssl.conf"
  docker compose up -d --force-recreate web
  docker compose exec -T web nginx -t
  check_application
  echo "Готово: https://$DOMAIN"
}

setup_cron() {
  step "Бэкапы в cron (каждый час) и продление сертификата (раз в неделю)"

  # В cron лежат только пути. Секреты читают wrappers из приватного .env.
  local backup_cmd="/bin/bash '$DEPLOY_DIR/backup.sh' >> /var/log/favorite-backup.log 2>&1"
  local renew_cmd="/bin/bash '$DEPLOY_DIR/renew-certs.sh'"

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
    echo
    echo "Стек поднят по HTTP. Дальше:"
    echo "  1) проверьте http://$DOMAIN/api/health (вход в аккаунт потребует HTTPS)"
    echo "  2) ./bootstrap.sh certs   — получить сертификат и включить HTTPS"
    echo "  3) ./bootstrap.sh cron    — поставить бэкапы в расписание"
    ;;
  *)
    echo "Неизвестная команда: $1 (ожидается all | certs | cron)" >&2
    exit 1
    ;;
esac
