#!/usr/bin/env bash
set -euo pipefail
[[ "$#" -eq 2 && "$1" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$ && "$2" =~ ^[a-f0-9]{40}$ ]]
restore_point="$1"
expected_sha="$2"
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_media_config
[[ "$(git -c safe.directory="$DEPLOY_DIR/.." rev-parse HEAD)" == "$expected_sha" ]]
export COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml:$DEPLOY_DIR/.state/ci-images.json"
trap 'echo "DEPLOY_FAILED restore_point=$restore_point. Inspect migrations before choosing rollback." >&2' ERR
docker compose config --quiet
docker exec favorite-postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"

database_bytes="$(docker exec favorite-postgres psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc 'SELECT pg_database_size(current_database())')"
/usr/bin/node - "$BACKUP_DIR" "$database_bytes" <<'NODE'
const fs = require("node:fs");
const [directory, size] = process.argv.slice(2);
if (!/^\d+$/.test(size)) throw new Error("Invalid database size");
const disk = fs.statfsSync(directory, { bigint: true });
if (disk.bavail * disk.bsize < 3221225472n + BigInt(size) * 2n) {
  throw new Error("DEPLOY_NOT_ENOUGH_SPACE_FOR_DATABASE_BACKUP");
}
NODE

release_database="$BACKUP_DIR/releases/$restore_point/database"
PG_CONTAINER=favorite-postgres PG_USER="$POSTGRES_USER" PG_DB="$POSTGRES_DB" \
  BACKUP_DIR="$release_database" GPG_RECIPIENT= S3_URI= HEALTHCHECK_URL= \
  node "$DEPLOY_DIR/../backend/scripts/backup/db-backup.cjs"
node "$DEPLOY_DIR/release.cjs" complete "$restore_point"

# Внешняя копия именно дампа перед миграцией, под уже удерживаемой общей блокировкой.
node - "$release_database" <<'NODE'
require("/usr/local/lib/favkino-backup/db-offsite.cjs")
  .backupOffsite({ directory: process.argv[2] })
  .catch((error) => { console.error(error.message); process.exitCode = 1; });
NODE

docker compose run --rm --no-deps --interactive=false --pull never migrate </dev/null
docker compose up -d --no-build --no-deps --pull never --wait --wait-timeout 120 backend
docker compose up -d --no-build --no-deps --pull never --force-recreate --wait --wait-timeout 120 web
docker compose exec -T web nginx -t
check_application
docker compose exec -T backend node dist/src/notification/publish-release.js /app/release-notes/current.json
echo "CI_RELEASE_OK $expected_sha"
