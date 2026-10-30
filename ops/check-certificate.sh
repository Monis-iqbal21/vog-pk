#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
certificate=$(mktemp)
trap 'rm -f -- "$certificate"' EXIT
if ! timeout 15 openssl s_client -connect 127.0.0.1:443 -servername 80-225-254-168.sslip.io -verify_hostname 80-225-254-168.sslip.io -verify_return_error </dev/null >"$certificate" 2>/dev/null; then
 printf 'VOGPK TLS validation failed.\n' >&2; exit 1
fi
openssl x509 -in "$certificate" -noout -checkend 1209600 >/dev/null || { printf 'VOGPK certificate expires within 14 days.\n' >&2; exit 1; }
printf 'VOGPK certificate chain, hostname and expiry checks passed.\n'
