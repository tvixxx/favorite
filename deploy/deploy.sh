#!/usr/bin/env bash
# Обновление: сборка → резервная копия → миграции → запуск → проверка.
#
#   ./deploy.sh          # обновить из текущей ветки
#   ./deploy.sh --no-pull  # собрать из того, что уже лежит на сервере
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_media_config

case "${1:-}" in
  --no-pull|"") ;;
  *) echo "Использование: ./deploy.sh [--no-pull]" >&2; exit 1 ;;
esac

if [[ "${1:-}" != "--no-pull" ]]; then
  step "Забираю изменения из git"
  git -C .. pull --ff-only
fi

step "Сборка образов, текущая версия продолжает работать"
docker compose build migrate
docker compose build backend
docker compose build web
step "Проверка PostgreSQL"
docker compose up -d --wait --wait-timeout 120 postgres
step "Резервная копия перед миграциями"
bash "$DEPLOY_DIR/backup.sh"
start_application
check_application
docker compose ps
echo "Обновление завершено. При ошибке смотрите docker compose logs --tail=100 backend web."
echo "Откат базы выполняйте вручную после проверки дампа и совместимости схемы."
