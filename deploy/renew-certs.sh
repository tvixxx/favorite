#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
docker run --rm \
  -v "$DATA_DIR/certbot/conf:/etc/letsencrypt" \
  -v "$DATA_DIR/certbot/www:/var/www/certbot" \
  certbot/certbot renew --webroot -w /var/www/certbot --quiet
docker compose exec -T web nginx -t
docker compose exec -T web nginx -s reload
