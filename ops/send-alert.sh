#!/usr/bin/env bash
# Called by systemd OnFailure. An existing SMTP service must be approved first.
set -Eeuo pipefail
logger -t vogpk-alert 'A VOGPK production check failed; inspect systemd status on Oracle.'
config=/etc/vogpk/alert.msmtprc
recipient_file=/etc/vogpk/alert-recipient
for file in "$config" "$recipient_file"; do
 [[ -f $file && ! -L $file ]] || { printf 'Approved email alert configuration is missing.\n' >&2; exit 1; }
 [[ $(stat -c %u "$file") == 0 && $(stat -c %a "$file") == 600 ]] || exit 1
done
recipient=$(cat "$recipient_file")
[[ $recipient =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]] || exit 1
printf 'To: %s\nSubject: VOGPK production check failed\nContent-Type: text/plain; charset=UTF-8\n\nA VOGPK API, database, backup or TLS check failed. Inspect Oracle service status. No credentials are included.\n' "$recipient" |
 msmtp --file="$config" --read-recipients --timeout=15 >/dev/null 2>&1 || { printf 'VOGPK email alert delivery failed.\n' >&2; exit 1; }
