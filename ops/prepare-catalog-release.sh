#!/usr/bin/env bash
# Non-running preparation only. Never reads production dotenv or touches systemd/DB.
set -Eeuo pipefail
umask 077
repo=/home/ubuntu/vog-pk
sha=${1:-}; baseline=${2:-}; reviewed_diff=${3:-}
fail(){ printf '%s\n' "$1" >&2; exit 1; }
[[ ${4:-} == --approved-prepare ]] || fail 'Explicit reviewed preparation required.'
[[ $sha =~ ^[a-f0-9]{40}$ && $baseline =~ ^[a-f0-9]{40}$ && $reviewed_diff =~ ^[a-f0-9]{64}$ ]] || fail 'Immutable commit and schema-diff hashes required.'
[[ $(id -un) == ubuntu && $(uname -m) == aarch64 && $(node -p 'process.versions.node.split(".")[0]') == 24 ]] || fail 'Existing Ubuntu ARM64 / Node 24 operator required.'
[[ $(git -C "$repo" remote get-url origin) == https://github.com/Monis-iqbal21/vog-pk.git ]] || fail 'Unexpected repository.'
git -C "$repo" cat-file -e "$sha^{commit}"
git -C "$repo" cat-file -e "$baseline^{commit}"
actual_diff=$(git -C "$repo" diff --no-ext-diff --binary "$baseline" "$sha" -- backend/prisma | sha256sum | cut -d' ' -f1)
[[ $actual_diff == "$reviewed_diff" ]] || fail 'Reviewed schema delta differs.'
[[ $(df -Pk "$repo" | awk 'NR==2 {print $4}') -ge 2097152 ]] || fail 'At least 2 GiB free working space required.'
state="$repo/.local/deploy-state"
mkdir -p "$state" "$repo/.local/releases"
exec 9>"$state/deploy.lock"
flock -n 9 || fail 'Deployment already in progress.'
target="$repo/.local/releases/$sha"
[[ ! -e $target ]] || fail 'Release exists; preserve it and inspect instead of overwriting.'
mkdir "$target"
git -C "$repo" archive "$sha" backend frontend | tar -x -C "$target"
( cd "$target" && find backend frontend -type f -print0 | sort -z | xargs -0 sha256sum > RELEASE_SOURCE.sha256 )
log="$state/catalog-build-$sha.log"
if ! env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 NODE_ENV=test /bin/bash -c '
 cd "$1/frontend" && npm ci &&
 cd "$1/backend" && npm ci && npm run build &&
 # BEGIN RELEASE_LINT
 mapfile -d "" lint_files < <(find src test -type f -name "*.ts" ! -path "src/generated/*" -print0) &&
 (( ${#lint_files[@]} > 0 )) &&
 npm exec --offline --no -- oxlint --type-aware --no-ignore "${lint_files[@]}" &&
 # END RELEASE_LINT
 npm test &&
 find dist -type f -print0 | sort -z | xargs -0 sha256sum > RELEASE_ARTIFACTS.sha256
' _ "$target" >"$log" 2>&1; then
 fail 'Preparation failed; release retained for private inspection. No service or database changes.'
fi
printf '%s\n' "$sha" >"$target/backend/RELEASE_COMMIT"
git -C "$repo" rev-parse "$sha:backend" >"$target/backend/RELEASE_BACKEND_TREE"
printf '%s\n' "$baseline $reviewed_diff" >"$target/backend/REVIEWED_SCHEMA_DELTA"
[[ -f $repo/backend/.env.local && ! -L $repo/backend/.env.local && $(stat -c %a "$repo/backend/.env.local") == 600 ]] || fail 'Existing private environment file required for later approved activation.'
# Existing activation tooling expects this link; no secret is copied or loaded.
ln -s "$repo/backend/.env.local" "$target/backend/.env.local"
printf 'Prepared non-running catalog release %s. DDL/foundation/import/activation remain separate approvals.\n' "$sha"
