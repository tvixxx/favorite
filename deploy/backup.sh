#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
export PG_CONTAINER="${PG_CONTAINER:-favorite-postgres}"
export PG_USER="$POSTGRES_USER"
export PG_DB="$POSTGRES_DB"
cd "$DEPLOY_DIR/../backend"
exec node scripts/backup/db-backup.cjs
