#!/usr/bin/env bash
# SGMS production smoke test — Faz 3 kabul kriterleri
set -euo pipefail

APP_ROOT="/www/wwwroot/sgms.cicibyte.com"
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  OK  ${name}"
  else
    echo "  FAIL ${name}"
    FAIL=1
  fi
}

echo "==> PM2"
PM2_LIST="$(sudo -u www env PATH="${APP_ROOT}/.tools/node/bin:${PATH}" PM2_HOME="${APP_ROOT}/.pm2" \
  "${APP_ROOT}/node_modules/.bin/pm2" jlist 2>/dev/null || echo '[]')"
if echo "$PM2_LIST" | grep -q '"name":"sgms-web"' && echo "$PM2_LIST" | grep -q '"status":"online"'; then
  echo "  OK  sgms-web online"
else
  echo "  FAIL sgms-web online"
  FAIL=1
fi

echo "==> Local app"
check "127.0.0.1:3100/login" "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/login | grep -q 200"

echo "==> Public HTTPS"
check "https://sgms.cicibyte.com/login" "curl -sf -o /dev/null -w '%{http_code}' https://sgms.cicibyte.com/login | grep -q 200"

echo "==> API auth (401 JSON)"
RESP="$(curl -s -o /dev/null -w '%{http_code}' https://sgms.cicibyte.com/api/v1/members)"
if [[ "$RESP" == "401" ]]; then
  echo "  OK  /api/v1/members → 401"
else
  echo "  FAIL /api/v1/members → ${RESP} (beklenen 401)"
  FAIL=1
fi

echo "==> AUTH_URL"
if grep -q 'AUTH_URL="https://sgms.cicibyte.com"' "${APP_ROOT}/apps/web/.env.local" 2>/dev/null; then
  echo "  OK  AUTH_URL prod"
else
  echo "  FAIL AUTH_URL"
  FAIL=1
fi

echo "==> Docker"
check "sgms-postgres healthy" "docker inspect -f '{{.State.Health.Status}}' sgms-postgres | grep -q healthy"
check "sgms-redis healthy" "docker inspect -f '{{.State.Health.Status}}' sgms-redis | grep -q healthy"

if [[ "$FAIL" -ne 0 ]]; then
  echo ""
  echo "Smoke test BAŞARISIZ."
  exit 1
fi

echo ""
echo "Smoke test başarılı."
