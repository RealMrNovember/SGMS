#!/usr/bin/env bash
# cloud.cicibyte.com entegrasyon doğrulaması — SGMS prod ortamında çalıştırılır.
set -euo pipefail

SENV=/www/wwwroot/sgms.cicibyte.com/apps/web/.env.local
if [ ! -f "$SENV" ]; then
  SENV=/www/wwwroot/sgms.cicibyte.com/apps/web/.env
fi

CLOUD_API_KEY=$(grep '^CLOUD_API_KEY=' "$SENV" | cut -d= -f2- | tr -d '\r"')
CLOUD_API_BASE_URL=$(grep '^CLOUD_API_BASE_URL=' "$SENV" | cut -d= -f2- | tr -d '\r"')
CLOUD_API_BASE_URL="${CLOUD_API_BASE_URL:-https://cloud.cicibyte.com/api}"

if [ -z "$CLOUD_API_KEY" ]; then
  echo "CLOUD_API_KEY=missing"
  exit 1
fi

echo "=== cloud.cicibyte.com health ==="
curl -sS "${CLOUD_API_BASE_URL}/v1/health"
echo

echo "=== API key format ==="
if [[ "$CLOUD_API_KEY" == cbcloud_* ]]; then
  echo "KEY_FORMAT=ok"
else
  echo "KEY_FORMAT=unexpected"
fi
