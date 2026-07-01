#!/usr/bin/env bash
# Authenticated smoke test for /admin/audit (run on production server)
set -euo pipefail

BASE="${1:-http://127.0.0.1:3100}"
EMAIL="${SEED_ADMIN_EMAIL:-admin@cicibyte.com}"
PASS="${SEED_ADMIN_PASSWORD:-}"

if [[ -z "$PASS" && -f /www/wwwroot/sgms.cicibyte.com/packages/database/.env ]]; then
  # shellcheck disable=SC1091
  source /www/wwwroot/sgms.cicibyte.com/packages/database/.env 2>/dev/null || true
  PASS="${SEED_ADMIN_PASSWORD:-}"
fi

if [[ -z "$PASS" ]]; then
  echo "SKIP: SEED_ADMIN_PASSWORD not set"
  exit 0
fi

COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

CSRF_JSON="$(curl -sf -c "$COOKIE_JAR" "$BASE/api/auth/csrf")"
CSRF="$(echo "$CSRF_JSON" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
if [[ -z "$CSRF" ]]; then
  echo "FAIL: could not get CSRF token"
  exit 1
fi

curl -sf -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE/api/auth/callback/credentials" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASS" \
  --data-urlencode 'callbackUrl=/admin/audit' \
  --data-urlencode 'json=true' \
  -o /dev/null

CODE="$(curl -s -o /tmp/audit-body.html -w '%{http_code}' -b "$COOKIE_JAR" "$BASE/admin/audit?category=security")"
if [[ "$CODE" == "200" ]] && ! grep -q 'Application error' /tmp/audit-body.html; then
  echo "OK  /admin/audit?category=security → $CODE"
  exit 0
fi

echo "FAIL /admin/audit?category=security → $CODE"
grep -o 'Digest: [0-9]*' /tmp/audit-body.html 2>/dev/null || true
grep -o 'Application error[^<]*' /tmp/audit-body.html 2>/dev/null | head -1 || true
exit 1
