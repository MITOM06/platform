#!/usr/bin/env bash
#
# Brings the mini up to whatever `main` currently is, and puts it back if that
# turns out to be broken.
#
# This exists because merging a fix is not the same as running it. PR #143 fixed
# social login, CI published the image, the mini pulled the commit — and kept
# serving the build from a week earlier for a day, with every health check
# green, until a user reported it. Nothing in the pipeline was watching the one
# thing that mattered.
#
#   ./scripts/mini/redeploy.sh           # deploy if anything changed, else nothing
#   ./scripts/mini/redeploy.sh --force   # redeploy even when nothing changed
#
# Silent when there is nothing to do, so launchd can run it on a short interval
# without filling the log. Exits non-zero only when the deployment is actually
# broken — that is the signal worth waking up for.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$ROOT/infra/docker-compose"
ENV_FILE="$DIR/.env.mini"
STATE_DIR="${PON_STATE_DIR:-$HOME/.local/state/pon-mini}"
LOCK="$STATE_DIR/redeploy.lock"

COMPOSE=(docker compose -p pon-mini -f "$DIR/compose.mini.yml" --env-file "$ENV_FILE")

FORCE=0
case "${1:-}" in
  --force) FORCE=1 ;;
  "")      ;;
  *)       echo "unknown flag: $1 (--force)"; exit 2 ;;
esac

log()  { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die()  { log "✗ $*"; exit 1; }

mkdir -p "$STATE_DIR"

# mkdir is atomic, so two overlapping runs cannot both proceed. A run that dies
# hard leaves the lock behind; anything older than an hour is stale by
# definition, since a deploy that takes an hour has already failed.
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then
    log "removing stale lock"; rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 0
  else
    exit 0   # another run holds it; not an error
  fi
fi
trap 'rm -rf "$LOCK"' EXIT

cd "$ROOT"
docker info >/dev/null 2>&1 || die "Docker is not running"
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found"

# ── docker credentials ──────────────────────────────────────────────────────
# Under launchd (and over SSH) there is no user session, so the macOS keychain
# cannot be unlocked and Docker Desktop's credential helper fails outright:
# "keychain cannot be accessed because the current session does not allow user
# interaction". The images are public and config.json holds no auths, so the
# helper has nothing to contribute — an empty credsStore skips it entirely.
# Note this only works for `docker pull`; `docker compose pull` ignores
# DOCKER_CONFIG and still calls the helper, which is why images are pulled one
# by one below and the stack is then brought up with --no-pull.
CLEAN_CFG="$(mktemp -d)"
printf '%s' '{"credsStore":""}' > "$CLEAN_CFG/config.json"
trap 'rm -rf "$LOCK" "$CLEAN_CFG"' EXIT

# Ask compose which images this stack runs, so adding a service to
# compose.mini.yml does not silently go unpulled. Only registries we can reach
# anonymously are pulled — Docker Hub still demands the credential helper, and
# caddy/cloudflared are pinned to stable tags that are already on disk.
images="$("${COMPOSE[@]}" config --images 2>/dev/null | grep '^ghcr\.io/' | sort -u)"
[ -n "$images" ] || die "no ghcr.io images found in compose.mini.yml"

image_id() { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || true; }

BEFORE="$(mktemp)"; AFTER="$(mktemp)"
trap 'rm -rf "$LOCK" "$CLEAN_CFG"; rm -f "$BEFORE" "$AFTER"' EXIT

for img in $images; do printf '%s\t%s\n' "$img" "$(image_id "$img")" >> "$BEFORE"; done
OLD_SHA="$(git rev-parse HEAD)"

# ── 1. catch up with main ───────────────────────────────────────────────────
# Caddyfile.mini and compose.mini.yml are read from the working tree, so an
# image-only update would leave routing changes behind. Only fast-forward, and
# only from a clean tree: someone debugging on the mini must not lose work.
branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  log "on branch '$branch', not main — leaving the checkout alone"
elif [ -n "$(git status --porcelain)" ]; then
  log "working tree is dirty — leaving the checkout alone"
else
  git fetch origin --quiet main 2>/dev/null || log "warning: git fetch failed, using local checkout"
  git merge --ff-only origin/main --quiet 2>/dev/null || true
fi
NEW_SHA="$(git rev-parse HEAD)"

# ── 2. pull images ──────────────────────────────────────────────────────────
for img in $images; do
  DOCKER_CONFIG="$CLEAN_CFG" docker pull -q "$img" >/dev/null 2>&1 \
    || log "warning: pull failed for $img (keeping the local copy)"
done
for img in $images; do printf '%s\t%s\n' "$img" "$(image_id "$img")" >> "$AFTER"; done

# ── 3. is there anything to do? ─────────────────────────────────────────────
changed=""
[ "$OLD_SHA" != "$NEW_SHA" ] && changed="commit $(git rev-parse --short "$OLD_SHA")→$(git rev-parse --short "$NEW_SHA")"
if ! diff -q "$BEFORE" "$AFTER" >/dev/null 2>&1; then
  updated="$(diff "$BEFORE" "$AFTER" | awk '/^>/ {split($2, a, "/"); printf "%s ", a[length(a)]}')"
  changed="${changed:+$changed, }images: ${updated% }"
fi
# A service that died since the last run is also a reason to act — otherwise the
# stack could sit half-down indefinitely because nothing upstream changed.
down="$("${COMPOSE[@]}" ps --services --filter status=running 2>/dev/null | sort > "$AFTER.run"; \
        "${COMPOSE[@]}" config --services 2>/dev/null | sort | comm -23 - "$AFTER.run" | tr '\n' ' ')"
rm -f "$AFTER.run"
[ -n "${down// /}" ] && changed="${changed:+$changed, }not running: ${down% }"

if [ -z "$changed" ] && [ "$FORCE" = 0 ]; then
  date '+%Y-%m-%dT%H:%M:%S' > "$STATE_DIR/last-check"
  exit 0
fi
log "deploying — ${changed:-forced}"

# ── 4. deploy ───────────────────────────────────────────────────────────────
"$ROOT/scripts/mini/up.sh" --no-pull >/dev/null 2>&1 || log "warning: up.sh reported a problem"

# Caddy reads a single bind-mounted file. On Docker Desktop for macOS a git
# checkout replaces that file with a new inode while the running container keeps
# the old one — which then does not exist, so the container sees no config at
# all and keeps serving whatever it parsed at start. `restart` reuses the same
# mount and does not fix it; only recreating the container re-resolves the path.
# That is how a merged Caddy change can be on disk for a week without taking
# effect. Test the container's own view rather than guessing from the diff.
if ! docker exec pon-mini-caddy-1 test -f /etc/caddy/Caddyfile 2>/dev/null \
   || ! git diff --quiet "$OLD_SHA" "$NEW_SHA" -- infra/docker-compose/Caddyfile.mini 2>/dev/null; then
  log "recreating caddy (config changed or its bind mount went stale)"
  "${COMPOSE[@]}" up -d --force-recreate --no-deps caddy >/dev/null 2>&1 \
    || log "warning: could not recreate caddy"
fi

# ── 5. verify, and undo if it is broken ─────────────────────────────────────
BASE="$(grep -E '^PON_API_BASE=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
BASE="${BASE%/}"
sleep 5   # containers are healthy before the tunnel has re-established routes

if "$ROOT/scripts/mini/smoke.sh" "$BASE" >"$STATE_DIR/last-smoke.log" 2>&1; then
  log "✓ deployed $(git rev-parse --short "$NEW_SHA") — smoke passed"
  date '+%Y-%m-%dT%H:%M:%S' | tee "$STATE_DIR/last-check" > "$STATE_DIR/last-deploy"
  exit 0
fi

log "✗ smoke failed after deploy — rolling back"
sed 's/^/    /' "$STATE_DIR/last-smoke.log"

# Retagging the previous image id back onto the moving tag is enough: the old
# image is still on disk, nothing was pruned. Anything that had no local image
# before is left alone — there is nothing to go back to.
while IFS="$(printf '\t')" read -r img id; do
  [ -n "$id" ] && docker tag "$id" "$img" >/dev/null 2>&1
done < "$BEFORE"
[ "$OLD_SHA" != "$NEW_SHA" ] && git reset --hard "$OLD_SHA" --quiet 2>/dev/null

"$ROOT/scripts/mini/up.sh" --no-pull >/dev/null 2>&1
"${COMPOSE[@]}" up -d --force-recreate --no-deps caddy >/dev/null 2>&1
sleep 5

if "$ROOT/scripts/mini/smoke.sh" "$BASE" >/dev/null 2>&1; then
  die "rolled back to $(git rev-parse --short "$OLD_SHA") — that build is serving again, but main is broken"
fi
die "rolled back to $(git rev-parse --short "$OLD_SHA") and smoke STILL fails — the mini needs a human"
