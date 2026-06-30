#!/usr/bin/env bash
# SGMS — tek komut production deploy (yalnızca sgms.cicibyte.com)
#
# Usage:
#   cd /www/wwwroot/sgms.cicibyte.com
#   sudo bash docs/deployment/deploy.sh
#
# Rollback:
#   git checkout <previous-commit> && sudo bash docs/deployment/deploy.sh
#   veya: PM2_HOME=.pm2 ./node_modules/.bin/pm2 resurrect

set -euo pipefail

APP_ROOT="/www/wwwroot/sgms.cicibyte.com"
NODE_DIR="${APP_ROOT}/.tools/node"
PM2_HOME="${APP_ROOT}/.pm2"
WEB_USER="www"
WEB_GROUP="www"

cd "${APP_ROOT}"

echo "==> [1/7] Git pull (www)"
sudo -u "${WEB_USER}" git pull --ff-only origin main

echo "==> [2/7] Node + pnpm install"
bash "${APP_ROOT}/.tools/install-node.sh" 2>/dev/null || true
export PATH="${NODE_DIR}/bin:${PATH}"
sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" \
  pnpm install --frozen-lockfile 2>/dev/null || \
  sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" pnpm install

echo "==> [3/7] Database migrate deploy"
sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" \
  pnpm --filter @sgms/database exec prisma migrate deploy

echo "==> [4/7] Build packages + web"
sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" pnpm build:packages
sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" pnpm web:build
chown -R "${WEB_USER}:${WEB_GROUP}" "${APP_ROOT}/apps/web/.next"

echo "==> [5/7] Docker stack (postgres/redis)"
docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d

echo "==> [6/7] PM2 reload (zero-downtime)"
PM2_BIN="${APP_ROOT}/node_modules/.bin/pm2"
sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" PM2_HOME="${PM2_HOME}" \
  "${PM2_BIN}" reload sgms-web --update-env

echo "==> [7/7] Smoke test"
sleep 3
bash "${APP_ROOT}/docs/deployment/verify-production.sh"

echo ""
echo "Deploy tamamlandı."
