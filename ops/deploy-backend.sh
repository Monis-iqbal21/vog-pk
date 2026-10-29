#!/usr/bin/env bash
# Run on Oracle as ubuntu. Never changes the live checkout, environment or database.
set -Eeuo pipefail
umask 077
repo=/home/ubuntu/vog-pk
releases="$repo/.local/releases"
state="$repo/.local/deploy-state"
dropin=/etc/systemd/system/vogpk-api.service.d/20-vogpk-release.conf
fail(){ printf '%s\n' "$1" >&2; exit 1; }
[[ $(id -un) == ubuntu ]] || fail 'Run as the existing ubuntu deployment operator.'
[[ -d $repo/.git ]] || fail 'Expected repository is missing.'
mkdir -p "$releases" "$state"
exec 9>"$state/deploy.lock"
flock -n 9 || fail 'Another deployment is in progress.'
action=${1:-}

check_env(){
 [[ -f $repo/backend/.env.local && ! -L $repo/backend/.env.local ]] || fail 'Existing production environment file is required.'
 [[ $(stat -c %a "$repo/backend/.env.local") == 600 ]] || fail 'Production environment file must be mode 600.'
}
release_path(){
 [[ ${1:-} =~ ^[a-f0-9]{40}$ ]] || fail 'Provide a full immutable commit SHA.'
 git -C "$repo" cat-file -e "$1^{commit}" 2>/dev/null || fail 'Commit is unavailable; fetch the approved revision first.'
 printf '%s/%s/backend' "$releases" "$1"
}
probe(){
 local mode=$1 endpoint=ready
 [[ $mode == legacy ]] && endpoint=''
 for ((attempt=0;attempt<15;attempt++)); do
  if curl --fail --silent --max-time 8 "http://127.0.0.1:4000/api/health${endpoint:+/$endpoint}" >/dev/null 2>&1; then
   # A healthy process must also preserve the approved loopback listener.
   ss -lntH 'sport = :4000' | awk '$4=="127.0.0.1:4000" {found=1} END {exit !found}' && return 0
  fi
  sleep 2
 done
 return 1
}
switch_to(){
 local target=$1 config="$state/release.conf"
 [[ $target == "$repo/backend" || $target =~ ^$releases/[a-f0-9]{40}/backend$ ]] || fail 'Unsafe release path.'
 [[ -f $target/dist/main.js && -d $target/node_modules && -f $target/.env.local ]] || fail 'Release is incomplete.'
 # Config contains only reviewed paths and nonsecret binding policy.
 if sudo -n test -e "$dropin"; then
  sudo -n grep -q '^# Managed by VOGPK release tooling$' "$dropin" || fail 'An unrelated release drop-in exists; inspect it before proceeding.'
 fi
 printf '# Managed by VOGPK release tooling\n[Service]\nWorkingDirectory=%s\nExecStart=\nExecStart=%s %s/dist/main.js\nEnvironment=NODE_ENV=production\nEnvironment=HOST=127.0.0.1\nUMask=0077\n' "$target" "$(command -v node)" "$target" >"$config" || return 1
 sudo -n install -d -m 755 /etc/systemd/system/vogpk-api.service.d || return 1
 sudo -n install -m 644 "$config" "$dropin" || return 1
 sudo -n systemctl daemon-reload || return 1
 sudo -n systemctl restart vogpk-api || return 1
}
save_previous_override(){
 if sudo -n test -e "$dropin"; then
  sudo -n test ! -L "$dropin" || fail 'Refusing a symlinked service override.'
  sudo -n grep -q '^# Managed by VOGPK release tooling$' "$dropin" || fail 'An unrelated release override exists; inspect before activation.'
  sudo -n install -m 600 -o ubuntu -g ubuntu "$dropin" "$state/previous-dropin.conf" || fail 'Could not save the previous override.'
  printf 'present\n' >"$state/previous-dropin.kind"
 else
  printf 'absent\n' >"$state/previous-dropin.kind"
 fi
}
restore_previous_override(){
 [[ -f $state/previous-dropin.kind ]] || fail 'No exact previous service override was recorded.'
 if sudo -n test -e "$dropin"; then
  sudo -n test ! -L "$dropin" || fail 'Refusing a symlinked service override.'
  sudo -n grep -q '^# Managed by VOGPK release tooling$' "$dropin" || fail 'Service override changed outside release tooling; inspect manually.'
 fi
 case $(cat "$state/previous-dropin.kind") in
  present)
   [[ -f $state/previous-dropin.conf ]] || fail 'The saved previous override is missing.'
   sudo -n install -m 644 "$state/previous-dropin.conf" "$dropin" || return 1
   ;;
  absent) sudo -n rm -f -- "$dropin" || return 1 ;;
  *) fail 'Invalid previous override state; inspect manually.' ;;
 esac
 sudo -n systemctl daemon-reload || return 1
 sudo -n systemctl restart vogpk-api || return 1
}

case "$action" in
 prepare)
  check_env
  target=$(release_path "${2:-}")
  [[ ! -e ${target%/backend} ]] || fail 'Release already exists; do not overwrite it.'
  [[ $(node -p 'process.versions.node.split(".")[0]') == 24 ]] || fail 'Node 24 is required.'
  [[ $(git -C "$repo" remote get-url origin) == https://github.com/Monis-iqbal21/vog-pk.git ]] || fail 'Unexpected Git remote.'
  mkdir -p "${target%/backend}"
  git -C "$repo" archive "$2" backend | tar -x -C "${target%/backend}"
  # Database changes require separate review; this workflow never migrates or seeds.
  cmp -s "$target/prisma/schema.prisma" "$repo/backend/prisma/schema.prisma" || fail 'Schema differs; review migration compatibility before preparing this release.'
  diff -qr "$target/prisma/migrations" "$repo/backend/prisma/migrations" >/dev/null || fail 'Migration files differ; separate review is required.'
  log="$state/build-$2.log"
  # Avoid accidental production dotenv loading and inherited runtime credentials.
  # Same-UID builds are still trusted code, not a hostile-code isolation boundary.
  if ! env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 NODE_ENV=test /bin/bash -c '
   cd "$1" && npm ci && npm run build &&
   mapfile -d "" lint_files < <(find src test -type f -name "*.ts" ! -path "src/generated/*" -print0) &&
   (( ${#lint_files[@]} > 0 )) &&
   npm exec --offline --no -- oxlint --type-aware --no-ignore "${lint_files[@]}" && npm test
  ' _ "$target" >"$log" 2>&1; then
   fail 'Release preparation failed. Review the private build log locally; do not paste credentials or connection details.'
  fi
  ln -s "$repo/backend/.env.local" "$target/.env.local"
  printf '%s\n' "$2" >"$target/RELEASE_COMMIT"
  printf 'Prepared release %s. Live service, environment and database unchanged.\n' "$2"
  ;;
 activate)
  [[ ${3:-} == --approved-restart ]] || fail 'Activation restarts production. Obtain approval before passing --approved-restart.'
  check_env
  target=$(release_path "${2:-}")
  [[ -f $target/RELEASE_COMMIT && $(cat "$target/RELEASE_COMMIT") == "$2" ]] || fail 'Prepare this release first.'
  previous=$(systemctl show vogpk-api -p WorkingDirectory --value)
  [[ $previous == "$repo/backend" || $previous =~ ^$releases/[a-f0-9]{40}/backend$ ]] || fail 'Unexpected service working directory; inspect manually.'
  [[ $previous != "$target" ]] || fail 'This release is already active.'
  save_previous_override
  printf '%s\n' "$previous" >"$state/previous"
  previous_mode=ready; [[ $previous == "$repo/backend" ]] && previous_mode=legacy
  if switch_to "$target" && probe ready; then
   printf '%s\n' "$target" >"$state/active"
   printf 'Release active and readiness/loopback verified.\n'
  else
   printf 'New release failed; restoring the previous application (no database rollback).\n' >&2
   restore_previous_override || fail 'Could not restore the previous service configuration; operator intervention required.'
   probe "$previous_mode" || fail 'Rollback health failed. Operator intervention required.'
   fail 'Activation failed; previous application restored.'
  fi
  ;;
 rollback)
  [[ ${2:-} == --approved-restart ]] || fail 'Rollback restarts production. Obtain approval before passing --approved-restart.'
  [[ -f $state/previous ]] || fail 'No previous release has been recorded.'
  target=$(cat "$state/previous")
  [[ $target == "$repo/backend" || $target =~ ^$releases/[a-f0-9]{40}/backend$ ]] || fail 'Unsafe previous release path.'
  [[ -f $target/dist/main.js && -d $target/node_modules ]] || fail 'Previous application artifacts are missing.'
  mode=ready; [[ $target == "$repo/backend" ]] && mode=legacy
  restore_previous_override || fail 'Could not restore the previous service configuration; operator intervention required.'
  probe "$mode" || fail 'Rollback health failed. Inspect service locally without disclosing its environment.'
  printf '%s\n' "$target" >"$state/active"
  printf 'Previous application restored. Database and credentials unchanged.\n'
  ;;
 *) fail 'Usage: deploy-backend.sh prepare FULL_SHA | activate FULL_SHA --approved-restart | rollback --approved-restart' ;;
esac
