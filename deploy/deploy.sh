#!/usr/bin/env bash
# Обновление уже работающего приложения. Порядок намеренно такой:
# слепок базы → сборка → миграции → перезапуск → проверка.
#
#   ./deploy.sh          # обновить из текущей ветки
#   ./deploy.sh --no-pull  # собрать из того, что уже лежит на сервере
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

set -a
# shellcheck disable=SC1091
source .env
set +a

BACKUP_DIR="${BACKUP_DIR:-/srv/favorite/backups}"
step() { printf "\n\033[1m==> %s\033[0m\n" "$1"; }

if [[ "${1:-}" != "--no-pull" ]]; then
  step "Забираю изменения из git"
  git -C .. pull --ff-only
fi

step "Слепок базы ПЕРЕД миграцией"
# Если миграция сломается, откатываться будем из этого файла
(cd ../backend && PG_CONTAINER="${PG_CONTAINER:-favorite-postgres}" \
  BACKUP_DIR="$BACKUP_DIR" PG_USER="$POSTGRES_USER" PG_DB="$POSTGRES_DB" \
  node scripts/backup/db-backup.cjs)

step "Сборка образов"
docker compose build

step "Перезапуск бэкенда и веба"
docker compose up -d

step "Миграции Prisma"
# migrate deploy применяет только новые миграции и не пересоздаёт базу
docker compose exec -T backend npx prisma migrate deploy

step "Проверка"
docker compose ps

# Живой сервер отвечает хоть каким-то кодом; 000 значит «не отвечает вовсе»
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1/api/movies" || true)"

if [[ "$code" == "000" ]]; then
  echo "Бэкенд не отвечает. Логи: docker compose logs --tail=50 backend" >&2
  exit 1
fi

echo "API отвечает (код $code). Обновление завершено."
echo "Если что-то пошло не так: docker compose logs --tail=100 backend"
echo "Откат базы: cd ../backend && node scripts/backup/db-restore.cjs <дамп> --into $POSTGRES_DB --yes"
