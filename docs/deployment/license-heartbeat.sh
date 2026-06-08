#!/usr/bin/env bash
# Merkezi lisans heartbeat — tüm organizasyonlar için check/sync
# Örnek crontab (www): 0 */6 * * * /www/wwwroot/sgms.cicibyte.com/docs/deployment/license-heartbeat.sh
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
  LICENSE_API_BASE_URL="${LICENSE_API_BASE_URL:-https://license.cicibyte.com}" \
  LICENSE_APP_CODE="${LICENSE_APP_CODE:-sgms}" \
  LICENSE_API_KEY="${LICENSE_API_KEY:-}" \
  pnpm --filter @sgms/license-client heartbeat
