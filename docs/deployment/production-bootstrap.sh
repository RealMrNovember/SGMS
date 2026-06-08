#!/usr/bin/env bash
# SGMS production bootstrap — TÜM işlemler yalnızca sgms.cicibyte.com içinde.
#
# DOKUNULMAZ:
#   - license.cicibyte.com (dizin + vhost)
#   - Diğer wwwroot siteleri
#   - /opt, /usr/local, global nginx reload (aaPanel'den siz uygularsınız)
#
# Usage:
#   cd /www/wwwroot/sgms.cicibyte.com
#   sudo bash docs/deployment/production-bootstrap.sh

set -euo pipefail

APP_ROOT="/www/wwwroot/sgms.cicibyte.com"
NODE_DIR="${APP_ROOT}/.tools/node"
PM2_HOME="${APP_ROOT}/.pm2"
LOG_DIR="${APP_ROOT}/logs/pm2"
WEB_USER="www"
WEB_GROUP="www"

cd "${APP_ROOT}"

echo "==> [1/5] Node.js 20 (proje içi: .tools/node)"
bash "${APP_ROOT}/.tools/install-node.sh"

echo "==> [2/5] pnpm install + build"
export PATH="${NODE_DIR}/bin:${PATH}"
mkdir -p "${LOG_DIR}" "${PM2_HOME}"
chown -R "${WEB_USER}:${WEB_GROUP}" "${APP_ROOT}/.tools" "${LOG_DIR}" "${PM2_HOME}" 2>/dev/null || true

sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" \
  pnpm install --frozen-lockfile 2>/dev/null || \
  sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" pnpm install

sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" pnpm --filter @sgms/database build
sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" pnpm web:build
chown -R "${WEB_USER}:${WEB_GROUP}" "${APP_ROOT}/apps/web/.next"

echo "==> [3/5] Production env (.env.local)"
ENV_FILE="${APP_ROOT}/apps/web/.env.local"
if ! grep -q '^AUTH_URL="https://sgms.cicibyte.com"' "${ENV_FILE}" 2>/dev/null; then
  {
    echo 'AUTH_URL="https://sgms.cicibyte.com"'
    echo 'NEXTAUTH_URL="https://sgms.cicibyte.com"'
  } >> "${ENV_FILE}"
fi
chown "${WEB_USER}:${WEB_GROUP}" "${ENV_FILE}"
chmod 640 "${ENV_FILE}"

echo "==> [4/5] PM2 (proje içi: .pm2 + logs/pm2)"
PM2_BIN="${APP_ROOT}/node_modules/.bin/pm2"
if [[ ! -x "${PM2_BIN}" ]]; then
  sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" \
    pnpm add -D -w pm2@5
  PM2_BIN="${APP_ROOT}/node_modules/.bin/pm2"
fi

sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" PM2_HOME="${PM2_HOME}" \
  "${PM2_BIN}" delete sgms-web 2>/dev/null || true

sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" PM2_HOME="${PM2_HOME}" \
  "${PM2_BIN}" start "${APP_ROOT}/ecosystem.config.cjs" --update-env

sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" PM2_HOME="${PM2_HOME}" \
  "${PM2_BIN}" save

echo "==> [5/5] Nginx — otomatik uygulanmaz"
echo ""
echo "    aaPanel'den sgms.cicibyte.com vhost'una reverse proxy ekleyin."
echo "    Adımlar: docs/deployment/NGINX-AAPANEL.md"
echo "    Snippet: docs/deployment/nginx/next-proxy.conf"
echo ""
echo "==> PM2 hazır. Durum:"
sudo -u "${WEB_USER}" env PATH="${NODE_DIR}/bin:${PATH}" PM2_HOME="${PM2_HOME}" \
  "${PM2_BIN}" status
