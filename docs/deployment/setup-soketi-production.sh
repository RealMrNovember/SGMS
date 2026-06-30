#!/usr/bin/env bash
# Configure Soketi on VDS: env vars, nginx proxy, container restart, PM2 reload.
# Usage: sudo bash docs/deployment/setup-soketi-production.sh

set -euo pipefail

APP_ROOT="/www/wwwroot/sgms.cicibyte.com"
DENV="${APP_ROOT}/infra/docker/.env"
WENV="${APP_ROOT}/apps/web/.env.local"
WEB_USER="www"

cd "${APP_ROOT}"

if ! grep -q '^SOKETI_APP_KEY=' "${DENV}" 2>/dev/null; then
  KEY="$(openssl rand -hex 16)"
  SECRET="$(openssl rand -hex 24)"
  cat >> "${DENV}" <<EOF

# Soketi (WebSocket)
SOKETI_HOST_BIND=127.0.0.1
SOKETI_PORT=6001
SOKETI_APP_ID=sgms
SOKETI_APP_KEY=${KEY}
SOKETI_APP_SECRET=${SECRET}
SOKETI_DEBUG=0
EOF
fi

KEY="$(grep '^SOKETI_APP_KEY=' "${DENV}" | cut -d= -f2- | tr -d '\r')"
SECRET="$(grep '^SOKETI_APP_SECRET=' "${DENV}" | cut -d= -f2- | tr -d '\r')"

grep -v -E '^(SOKETI_|NEXT_PUBLIC_SOKETI_)' "${WENV}" > /tmp/sgms-web.env
cat /tmp/sgms-web.env > "${WENV}"
cat >> "${WENV}" <<EOF
SOKETI_APP_ID=sgms
SOKETI_APP_KEY=${KEY}
SOKETI_APP_SECRET=${SECRET}
SOKETI_HOST=127.0.0.1
SOKETI_PORT=6001
SOKETI_USE_TLS=false
NEXT_PUBLIC_SOKETI_KEY=${KEY}
NEXT_PUBLIC_SOKETI_WS_PATH=/realtime/app
NEXT_PUBLIC_SOKETI_WS_PORT=443
NEXT_PUBLIC_SOKETI_WSS_PORT=443
NEXT_PUBLIC_SOKETI_FORCE_TLS=true
EOF
chown "${WEB_USER}:${WEB_USER}" "${WENV}"

EXT="/www/server/panel/vhost/nginx/extension/sgms.cicibyte.com"
mkdir -p "${EXT}"
cat > "${EXT}/realtime.conf" <<'NGINX'
location /realtime/ {
    proxy_pass http://127.0.0.1:6001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
NGINX

nginx -t
nginx -s reload

docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d soketi
sleep 8

echo "Soketi health: $(docker inspect -f '{{.State.Health.Status}}' sgms-soketi)"
echo "Soketi HTTP: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:6001/)"

PM2_BIN="${APP_ROOT}/node_modules/.bin/pm2"
sudo -u "${WEB_USER}" env PATH="${APP_ROOT}/.tools/node/bin:${PATH}" PM2_HOME="${APP_ROOT}/.pm2" \
  "${PM2_BIN}" reload sgms-web --update-env

echo "Soketi production setup complete."
