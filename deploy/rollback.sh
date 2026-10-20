#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
if command -v flock >/dev/null 2>&1; then
  exec flock --close -w 900 /run/lock/favkino-deploy-backup.lock \
    node "$DEPLOY_DIR/release.cjs" "$@"
fi
node "$DEPLOY_DIR/release.cjs" "$@"
