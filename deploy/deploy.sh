#!/usr/bin/env bash
# Обновление: сборка → резервная копия → миграции → запуск → проверка.
#
#   ./deploy.sh          # обновить из текущей ветки
#   ./deploy.sh --no-pull  # собрать из того, что уже лежит на сервере
set -euo pipefail

if command -v flock >/dev/null 2>&1 && [[ "${FAVKINO_MANUAL_DEPLOY_LOCKED:-}" != 1 ]]; then
  exec flock --close -w 900 /run/lock/favkino-deploy-backup.lock \
    env FAVKINO_MANUAL_DEPLOY_LOCKED=1 /bin/bash "${BASH_SOURCE[0]}" "$@"
fi

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_media_config

case "${1:-}" in
  --no-pull|"") ;;
  *) echo "Использование: ./deploy.sh [--no-pull]" >&2; exit 1 ;;
esac

step "Сохранение прежних образов и конфигурации"
restore_point="$(node "$DEPLOY_DIR/release.cjs" snapshot)"
echo "Точка возврата: $restore_point"
trap 'echo "DEPLOY_FAILED. Для выбора точки выполните: bash rollback.sh list" >&2' ERR

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
PG_CONTAINER="${PG_CONTAINER:-favorite-postgres}" PG_USER="$POSTGRES_USER" PG_DB="$POSTGRES_DB" \
  BACKUP_DIR="$BACKUP_DIR/releases/$restore_point/database" \
  node "$DEPLOY_DIR/../backend/scripts/backup/db-backup.cjs"
node "$DEPLOY_DIR/release.cjs" complete "$restore_point"
start_application
check_application
docker compose exec -T backend node dist/src/notification/publish-release.js /app/release-notes/current.json
docker compose ps
echo "Обновление завершено. При ошибке смотрите docker compose logs --tail=100 backend web."
echo "Точка возврата: $restore_point. Инструкция: deploy/RECOVERY.md"
