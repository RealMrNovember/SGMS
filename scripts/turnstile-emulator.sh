#!/usr/bin/env bash
# Turnike emülatörü — check-in ve offline sync testi
# Usage: DEVICE_KEY=sgms_dev_xxx RFID_TAG=04A1B2C3 API_BASE=https://sgms.cicibyte.com bash scripts/turnstile-emulator.sh

set -euo pipefail

API_BASE="${API_BASE:-https://sgms.cicibyte.com}"
DEVICE_KEY="${DEVICE_KEY:?Set DEVICE_KEY}"
RFID_TAG="${RFID_TAG:-DEMO-RFID-001}"
CLIENT_ID="$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)"

echo "==> Pull member cache"
curl -sS "${API_BASE}/api/v1/sync/pull" \
  -H "X-Device-Key: ${DEVICE_KEY}" | head -c 400
echo ""
echo ""

echo "==> Online check-in (RFID)"
curl -sS -X POST "${API_BASE}/api/v1/check-in" \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: ${DEVICE_KEY}" \
  -d "{\"rfidTag\":\"${RFID_TAG}\",\"clientEventId\":\"${CLIENT_ID}-online\"}"
echo ""
echo ""

echo "==> Offline sync push (simulated queue)"
SYNC_ID="$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)"
curl -sS -X POST "${API_BASE}/api/v1/sync/push" \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: ${DEVICE_KEY}" \
  -d "{\"events\":[{\"clientEventId\":\"${SYNC_ID}\",\"method\":\"RFID\",\"rfidTag\":\"${RFID_TAG}\",\"checkedInAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}]}"
echo ""
echo "Done."
