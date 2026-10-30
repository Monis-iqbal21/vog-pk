#!/usr/bin/env bash
# Stream a custom-format dump into an approved encrypted remote restic repository.
set -Eeuo pipefail
umask 077
fail(){ printf '%s\n' "$1" >&2; exit 1; }
[[ ${BACKUP_DESTINATION_APPROVED:-} == yes ]] || fail 'Backup destination has not been approved.'
[[ ${BACKUP_REPOSITORY_DEDICATED:-} == yes ]] || fail 'Use a dedicated approved VOGPK backup repository.'
[[ ${RESTIC_REPOSITORY:-} == s3:https://* || ${RESTIC_REPOSITORY:-} == sftp:* || ${RESTIC_REPOSITORY:-} == rest:https://* ]] || fail 'Configure an approved remote repository over a secure transport.'
[[ $RESTIC_REPOSITORY != *'?'* && $RESTIC_REPOSITORY != *'@'* || $RESTIC_REPOSITORY == sftp:* ]] || fail 'Do not embed credentials or signed URLs in the repository location.'
for command in pg_dump restic python3 flock; do command -v "$command" >/dev/null || fail 'Install the required backup tools first.'; done
for variable in RESTIC_PASSWORD_FILE PGSERVICEFILE PGPASSFILE; do
 file=${!variable:-}
 [[ -n $file && -f $file && ! -L $file ]] || fail 'A required private credential file is missing.'
 [[ $(stat -c %u "$file") == "$(id -u)" ]] || fail 'Private files must belong to the backup service user.'
 [[ $(stat -c %a "$file") == 600 || $(stat -c %a "$file") == 400 ]] || fail 'Private files must be mode 600 or 400.'
done
[[ -z ${PGPASSWORD:-} && -z ${DATABASE_URL:-} ]] || fail 'Use protected libpq service/pass files, not password environment variables.'
export PGSERVICE=vogpk-backup PGCONNECT_TIMEOUT=15 PGOPTIONS='-c statement_timeout=300000 -c lock_timeout=10000'
state=${STATE_DIRECTORY:-/var/lib/vogpk-backup}
[[ -d $state ]] || fail 'Backup state directory is missing.'
exec 9>"$state/backup.lock"
flock -n 9 || fail 'Another backup is running.'
result=$(mktemp "$state/result.XXXXXX")
errors=$(mktemp "$state/errors.XXXXXX")
trap 'rm -f -- "$result" "$errors"' EXIT
# A failed producer can still create a restic snapshot. It remains tagged pending,
# never selected as a complete recovery point and never eligible for retention.
if ! pg_dump --no-password --format=custom --no-owner --no-acl 2>"$errors" |
 restic backup --stdin --stdin-filename vogpk.dump --host vogpk-oracle --tag vogpk-postgres-pending --json >"$result" 2>>"$errors"; then
 fail 'Backup failed; no complete recovery point was recorded. Inspect provider/tool configuration privately.'
fi
snapshot=$(python3 - "$result" <<'PY'
import json,sys,re
snapshots=[]
for line in open(sys.argv[1]):
    item=json.loads(line)
    if item.get('message_type')=='summary' and item.get('snapshot_id'): snapshots.append(item['snapshot_id'])
if len(snapshots)!=1 or not re.fullmatch('[a-f0-9]{8,64}',snapshots[0]): raise SystemExit(1)
print(snapshots[0])
PY
) || fail 'Backup result could not be validated; snapshot remains pending.'
restic tag --remove vogpk-postgres-pending --add vogpk-postgres-complete "$snapshot" >"$result" 2>"$errors" || fail 'Backup completed but could not be marked complete.'
restic forget --host vogpk-oracle --tag vogpk-postgres-complete --group-by host,tags --keep-daily 7 --keep-weekly 4 --keep-monthly 6 >"$result" 2>"$errors" || fail 'Backup completed but retention failed.'
if [[ ${BACKUP_WEEKLY_PRUNE_APPROVED:-no} == yes && $(date -u +%u) == 7 ]]; then
 restic check >"$result" 2>"$errors" && restic prune >"$result" 2>"$errors" && restic check >"$result" 2>"$errors" || fail 'Backup completed but repository maintenance failed.'
fi
date -u +%FT%TZ >"$state/last-success"
printf 'Encrypted remote PostgreSQL backup and scoped snapshot retention completed.\n'
# Without approved weekly pruning, forgotten data continues occupying storage.
