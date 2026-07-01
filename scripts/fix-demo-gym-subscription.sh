#!/usr/bin/env bash
# demo-gym aboneliğini 30 gün deneme olarak sıfırla (prod bakım)
set -euo pipefail

docker exec sgms-postgres psql -U sgms -d sgms <<'SQL'
UPDATE subscriptions s
SET
  status = 'TRIALING',
  trial_ends_at = NOW() + INTERVAL '30 days',
  current_period_end = NOW() + INTERVAL '30 days',
  canceled_at = NULL
FROM organizations o
WHERE s.organization_id = o.id AND o.slug = 'demo-gym';

UPDATE organizations
SET
  status = 'ACTIVE',
  central_license_status = 'TRIAL',
  license_expires_at = NOW() + INTERVAL '30 days'
WHERE slug = 'demo-gym';
SQL

echo "demo-gym subscription reset OK"
