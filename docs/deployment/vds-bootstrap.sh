#!/usr/bin/env bash
# aaPanel VDS bootstrap — 31.40.199.47
# Mevcut sitelere (ör. license.cicibyte.com) dokunmaz; yalnızca sgms dizinini hazırlar.
#
# Usage (VDS Remote SSH):
#   sudo bash docs/deployment/vds-bootstrap.sh

set -euo pipefail

APP_ROOT="/www/wwwroot/sgms.cicibyte.com"
WEB_USER="www"
WEB_GROUP="www"

echo "==> Creating ${APP_ROOT} (aaPanel wwwroot)"
mkdir -p "${APP_ROOT}/data/postgres"
mkdir -p "${APP_ROOT}/data/redis"
mkdir -p "${APP_ROOT}/infra/docker"

chown -R "${WEB_USER}:${WEB_GROUP}" "${APP_ROOT}"
chmod -R 755 "${APP_ROOT}"
chmod -R 770 "${APP_ROOT}/data"

echo "==> Ownership:"
ls -la /www/wwwroot/ | grep sgms || ls -la "${APP_ROOT}"

echo "==> Done."
echo "    Path: ${APP_ROOT}"
echo "    Owner: ${WEB_USER}:${WEB_GROUP}"
echo ""
echo "    Next (after git clone):"
echo "    cd ${APP_ROOT}"
echo "    cp infra/docker/.env.example infra/docker/.env"
echo "    # Set SGMS_DATA_DIR=${APP_ROOT}/data"
echo "    docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d"
