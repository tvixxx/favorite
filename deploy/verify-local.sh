#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work_dir="$(mktemp -d)"
run_id="$(date +%s)-$$"
network="favourite-qa-$run_id"
postgres="favourite-qa-postgres-$run_id"
backend="favourite-qa-backend-$run_id"
web="favourite-qa-web-$run_id"
backend_image="favourite-backend:qa-$run_id"
migrate_image="favourite-migrate:qa-$run_id"
web_image="favourite-web:qa-$run_id"

cleanup() {
  result=$?

  if [[ "$result" != 0 ]]; then
    docker logs --tail=40 "$backend" 2>/dev/null || true
    docker logs --tail=40 "$web" 2>/dev/null || true
  fi

  docker rm -fv "$web" "$backend" "$postgres" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  docker image rm "$web_image" "$backend_image" "$migrate_image" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
}

trap cleanup EXIT
cd "$project_dir"

echo "1/8: синтаксис deploy-скриптов"
for script in deploy/*.sh; do
  bash -n "$script"
done

echo "2/8: Compose с отдельной тестовой конфигурацией"
cat > "$work_dir/check.env" <<'CONFIG'
DOMAIN=example.test
POSTGRES_USER=qa
POSTGRES_PASSWORD=qa_local_only
POSTGRES_DB=qa
JWT_SECRET=qa_local_only_never_use_in_production
MEDIA_PUBLIC_BASE_URL=https://images.example.test
MEDIA_S3_ENDPOINT=https://s3.example.test
MEDIA_S3_BUCKET=qa
MEDIA_S3_ACCESS_KEY=qa
MEDIA_S3_SECRET_KEY=qa
CONFIG

docker compose --env-file "$work_dir/check.env" -f deploy/docker-compose.yml config --quiet

echo "3/8: Linux amd64 образы"
docker build --platform linux/amd64 --target build -t "$migrate_image" backend
docker build --platform linux/amd64 -t "$backend_image" backend
docker build --platform linux/amd64 -t "$web_image" frontend

echo "4/8: PNG и HEIC в worker runtime-образа, без Prisma CLI"
docker run --rm --platform linux/amd64 --network none \
  -v "$project_dir/backend/src/media/fixtures/example.heic:/qa/example.heic:ro" \
  "$backend_image" node -e '
const fs = require("node:fs");
const sharp = require("sharp");
const { ImageProcessor } = require("./dist/src/media/image-processor.service");
const { MEDIA_POLICIES } = require("./dist/src/media/media-policy");
async function check() {
  if (fs.existsSync("/app/node_modules/prisma")) throw new Error("CLI remains in runtime");
  const processor = new ImageProcessor();
  try {
    const png = await sharp({ create: { width: 20, height: 30, channels: 3, background: "white" } }).png().toBuffer();
    for (const input of [png, fs.readFileSync("/qa/example.heic")]) {
      const result = await processor.process(input, MEDIA_POLICIES.MOVIE_POSTER);
      const metadata = await sharp(result.main).metadata();
      if (metadata.format !== "webp" || !metadata.width || !metadata.height) throw new Error("Image processing failed");
      console.log("WebP:", metadata.width, "x", metadata.height);
    }
  } finally {
    processor.onModuleDestroy();
  }
}
check().catch(error => { console.error(error.message); process.exitCode = 1; });'

echo "5/8: миграции на отдельной пустой PostgreSQL 18"
docker network create "$network" >/dev/null
docker run -d --platform linux/amd64 --name "$postgres" --network "$network" --network-alias postgres \
  -e POSTGRES_USER=qa -e POSTGRES_PASSWORD=qa_local_only -e POSTGRES_DB=qa postgres:18-alpine >/dev/null

for attempt in {1..60}; do
  if docker exec "$postgres" pg_isready -U qa -d qa >/dev/null 2>&1; then
    break
  fi

  sleep 1
done

docker run --rm --platform linux/amd64 --network "$network" \
  -e DATABASE_URL=postgresql://qa:qa_local_only@postgres:5432/qa \
  "$migrate_image" yarn prisma migrate deploy

echo "6/8: backup → verify → restore на одноразовой PostgreSQL"
docker exec "$postgres" psql -U qa -d qa -v ON_ERROR_STOP=1 -c \
  "INSERT INTO users (id, email, password, \"fullName\", updated_at, role, auth_version)
   VALUES ('qa-backup-user', 'backup@example.test', 'not-a-login-hash', 'QA restore', NOW(), 'ADMIN', 7)"
docker exec "$postgres" createdb -U qa qa_verify
docker exec "$postgres" psql -U qa -d qa_verify -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE sentinel (value INT); INSERT INTO sentinel VALUES (42)"

export PG_CONTAINER="$postgres" PG_USER=qa PG_DB=qa BACKUP_DIR="$work_dir/backups"
# Проверка не должна использовать настройки внешних хранилищ или мониторинга хоста.
export S3_URI= GPG_RECIPIENT= HEALTHCHECK_URL=
node backend/scripts/backup/db-backup.cjs
for file in "$BACKUP_DIR"/qa-*.dump; do backup_file="$file"; done
node backend/scripts/backup/db-verify.cjs "$backup_file"
[[ "$(docker exec "$postgres" psql -U qa -d qa_verify -tAc 'SELECT value FROM sentinel')" == 42 ]]
[[ "$(docker exec "$postgres" psql -U qa -d qa -tAc "SELECT count(*) FROM pg_database WHERE datname LIKE 'favourite_verify_%'")" == 0 ]]

node backend/scripts/backup/db-restore.cjs "$backup_file" --into qa_restored
[[ "$(docker exec "$postgres" psql -U qa -d qa -tAc "SELECT count(*) FROM pg_database WHERE datname = 'qa_restored'")" == 0 ]]
node backend/scripts/backup/db-restore.cjs "$backup_file" --into qa_restored --yes
restored_user="$(docker exec "$postgres" psql -U qa -d qa_restored -tAc "SELECT \"fullName\" || ':' || role || ':' || auth_version FROM users WHERE id = 'qa-backup-user'")"
[[ "$restored_user" == 'QA restore:ADMIN:7' ]]
source_migrations="$(docker exec "$postgres" psql -U qa -d qa -tAc 'SELECT count(*) FROM _prisma_migrations')"
[[ "$(docker exec "$postgres" psql -U qa -d qa_restored -tAc 'SELECT count(*) FROM _prisma_migrations')" == "$source_migrations" ]]

# Занятая новая цель сохраняет свои данные.
echo "Проверка отказа: qa_verify уже существует, ошибка ожидается"
if node backend/scripts/backup/db-restore.cjs "$backup_file" --into qa_verify --yes; then
  echo "Restore unexpectedly replaced an existing database" >&2
  exit 1
fi
[[ "$(docker exec "$postgres" psql -U qa -d qa_verify -tAc 'SELECT value FROM sentinel')" == 42 ]]

# Зависимость, которой нет в дампе, вызывает ошибку DROP и полный откат restore.
echo "Проверка отката: зависимость restore_guard, ошибка ожидается"
docker exec "$postgres" psql -U qa -d qa_restored -v ON_ERROR_STOP=1 -c \
  "UPDATE users SET \"fullName\" = 'Preserved'; CREATE TABLE restore_guard (user_id TEXT REFERENCES users(id))"
if PG_DB=qa_restored node backend/scripts/backup/db-restore.cjs "$backup_file" --into qa_restored --yes; then
  echo "Restore unexpectedly ignored a dependent table" >&2
  exit 1
fi
[[ "$(docker exec "$postgres" psql -U qa -d qa_restored -tAc "SELECT \"fullName\" FROM users WHERE id = 'qa-backup-user'")" == Preserved ]]
echo "FAVOURITE_BACKUP_RESTORE_OK"

echo "7/8: API и nginx в отдельной сети, порты хоста не публикуются"
docker run -d --platform linux/amd64 --name "$backend" --network "$network" --network-alias backend \
  --env-file "$work_dir/check.env" \
  -e DATABASE_URL=postgresql://qa:qa_local_only@postgres:5432/qa -e NODE_ENV=production -e PORT=3005 \
  -e JWT_ACCESS_TOKEN_TTL=2h -e JWT_REFRESH_TOKEN_TTL=7d -e COOKIE_DOMAIN= \
  -e CORS_ORIGINS=https://example.test \
  "$backend_image" >/dev/null

ready=false

for attempt in {1..60}; do
  if docker exec "$backend" node -e 'fetch("http://127.0.0.1:3005/health").then(async r=>{if(!r.ok||(await r.json()).status!=="ok")process.exit(1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then
    ready=true
    break
  fi

  sleep 1
done

[[ "$ready" == true ]] || { echo "API readiness failed" >&2; exit 1; }

docker run --rm --platform linux/amd64 --network "$network" \
  -v "$project_dir/deploy/nginx/app.conf:/etc/nginx/conf.d/default.conf:ro" "$web_image" nginx -t
docker run -d --platform linux/amd64 --name "$web" --network "$network" \
  -v "$project_dir/deploy/nginx/app.conf:/etc/nginx/conf.d/default.conf:ro" "$web_image" >/dev/null

# docker run -d завершается до готовности nginx принимать соединения.
web_ready=false

for attempt in {1..30}; do
  if docker exec "$web" wget -q -T 2 -O /dev/null http://127.0.0.1/api/health >/dev/null 2>&1; then
    web_ready=true
    break
  fi

  sleep 1
done

[[ "$web_ready" == true ]] || { echo "nginx API readiness failed" >&2; exit 1; }

docker exec "$web" wget -q -T 5 -O- http://127.0.0.1/api/health
docker exec "$web" sh -c 'wget -q -T 5 -O- http://127.0.0.1/ | grep -q "<div id=\"app\""'

echo
echo "8/8: HTTPS-конфигурация с одноразовым тестовым сертификатом"
mkdir -p "$work_dir/certs/live/example.test"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=example.test \
  -keyout "$work_dir/certs/live/example.test/privkey.pem" \
  -out "$work_dir/certs/live/example.test/fullchain.pem" >/dev/null 2>&1
docker run --rm --platform linux/amd64 --network none -e DOMAIN=example.test \
  -v "$project_dir/deploy/nginx/app-ssl.conf:/template.conf:ro" \
  --entrypoint /bin/sh "$web_image" -c "envsubst '\${DOMAIN}' < /template.conf" > "$work_dir/nginx-ssl.conf"
docker run --rm --platform linux/amd64 --network "$network" \
  -v "$work_dir/nginx-ssl.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$work_dir/certs:/etc/letsencrypt:ro" "$web_image" nginx -t

echo "FAVOURITE_DOCKER_CHECK_OK"
