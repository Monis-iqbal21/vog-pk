#!/usr/bin/env bash
set -Eeuo pipefail
fail(){ logger -t vogpk-monitor -- "$1"; printf '%s\n' "$1" >&2; exit 1; }
for unit in vogpk-api caddy; do systemctl is-active --quiet "$unit" || fail 'VOGPK service is inactive.'; done
curl --fail --silent --max-time 8 http://127.0.0.1:4000/api/health >/dev/null 2>&1 || fail 'VOGPK liveness check failed.'
curl --fail --silent --max-time 8 http://127.0.0.1:4000/api/health/ready >/dev/null 2>&1 || fail 'VOGPK database readiness check failed.'
curl --fail --silent --max-time 12 https://80-225-254-168.sslip.io/api/health >/dev/null 2>&1 || fail 'VOGPK HTTPS proxy check failed.'
printf 'VOGPK API, database readiness and HTTPS proxy checks passed.\n'
