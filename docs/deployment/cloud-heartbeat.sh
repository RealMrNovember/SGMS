#!/usr/bin/env bash
# CiciByte Cloud (cloud.cicibyte.com) heartbeat — tüm organizasyonlar için tenant senkronu
# Örnek crontab (www): 0 */6 * * * /www/wwwroot/sgms.cicibyte.com/docs/deployment/cloud-heartbeat.sh
set -euo pipefail

APP_ROOT="/www/wwwroot/sgms.cicibyte.com"
NODE_DIR="${APP_ROOT}/.tools/node"
ENV_FILE="${APP_ROOT}/apps/web/.env.local"

cd "${APP_ROOT}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

export PATH="${NODE_DIR}/bin:${PATH}"
export DATABASE_URL

sudo -u www env PATH="${NODE_DIR}/bin:${PATH}" DATABASE_URL="${DATABASE_URL}" \
  CLOUD_API_BASE_URL="${CLOUD_API_BASE_URL:-https://cloud.cicibyte.com/api}" \
  CLOUD_PRODUCT_SLUG="${CLOUD_PRODUCT_SLUG:-sgms}" \
  CLOUD_API_KEY="${CLOUD_API_KEY:-}" \
  pnpm --filter @sgms/cloud-client heartbeat
