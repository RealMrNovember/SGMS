#!/usr/bin/env bash
set -euo pipefail

LENV=/www/wwwroot/license.cicibyte.com/.env
SENV=/www/wwwroot/sgms.cicibyte.com/apps/web/.env.local
if [ ! -f "$SENV" ]; then
  SENV=/www/wwwroot/sgms.cicibyte.com/apps/web/.env
fi

LK=$(grep '^LICENSE_API_KEY=' "$LENV" | cut -d= -f2- | tr -d '\r"')
SK=$(grep '^LICENSE_API_KEY=' "$SENV" | cut -d= -f2- | tr -d '\r"')

if [ "$LK" = "$SK" ] && [ -n "$LK" ]; then
  echo "KEY_MATCH=yes"
else
  echo "KEY_MATCH=no"
fi

set -a
# shellcheck disable=SC1090
. "$LENV"
set +a

echo "=== applications ==="
mysql -h127.0.0.1 -u"$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" -N -e \
  "SELECT id, name, app_code, is_active FROM applications;"

echo "=== sgms license count ==="
mysql -h127.0.0.1 -u"$DB_USERNAME" -p"$DB_PASSWORD" "$DB_DATABASE" -N -e \
  "SELECT COUNT(*) FROM licenses l JOIN applications a ON l.application_id=a.id WHERE a.app_code='sgms';"

HWID=$(cat /proc/sys/kernel/random/uuid)
EMAIL="probe-$(date +%s)@sgms-test.local"
RESP=$(curl -sS -X POST "https://license.cicibyte.com/api/v1/license/trial" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $LK" \
  -d "{\"app_code\":\"sgms\",\"hwid\":\"$HWID\",\"client_name\":\"SGMS Integration Probe\",\"email\":\"$EMAIL\"}")

echo "TRIAL_RESPONSE=$RESP"
