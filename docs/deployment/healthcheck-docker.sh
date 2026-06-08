#!/usr/bin/env bash
# Opsiyonel cron: Docker stack sağlık kontrolü (sgms only)
# Örnek crontab (root): */5 * * * * /www/wwwroot/sgms.cicibyte.com/docs/deployment/healthcheck-docker.sh
set -euo pipefail

APP_ROOT="/www/wwwroot/sgms.cicibyte.com"
LOG="${APP_ROOT}/logs/docker-health.log"
TS="$(date -Iseconds)"

cd "${APP_ROOT}"

for svc in sgms-postgres sgms-redis; do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$svc" 2>/dev/null || echo missing)"
  if [[ "$status" != "healthy" ]]; then
    echo "${TS} WARN ${svc}=${status} — restarting stack" >> "${LOG}"
    docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d >> "${LOG}" 2>&1 || true
    exit 1
  fi
done

echo "${TS} OK postgres+redis healthy" >> "${LOG}"
