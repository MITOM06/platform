#!/usr/bin/env bash
#
# redeploy.sh runs unattended every five minutes on the production mini, so its
# failure paths are the ones that matter. These tests run it against a throwaway
# git remote with docker, up.sh and smoke.sh stubbed out, and check that:
#   - a build that fails smoke is rolled back AND not redeployed every 5 minutes;
#   - a later commit on main is deployed normally;
#   - an up.sh failure (e.g. a new required variable missing from .env.mini) is a
#     failed deploy that rolls back, not a warning followed by "✓ deployed".
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/state"
export PON_STATE_DIR="$T/state"
export QC_T="$T"

# ── stubs ────────────────────────────────────────────────────────────────────
cat > "$T/bin/docker" <<'SH'
#!/usr/bin/env bash
case "$*" in
  info*)                       exit 0 ;;
  *"config --images"*)         echo "ghcr.io/acme/pon-auth:latest" ;;
  *"config --services"*)       echo "auth" ;;
  *"ps --services"*)           echo "auth" ;;
  "image inspect"*)            echo "sha256:img-$(cat "$QC_T/image_rev" 2>/dev/null || echo 0)" ;;
  *)                           exit 0 ;;   # pull, tag, exec, compose up …
esac
SH
chmod +x "$T/bin/docker"
export PATH="$T/bin:$PATH"

# A checkout of "main" whose scripts/mini holds the real redeploy.sh and stubs.
git init -q --bare "$T/remote.git"
git clone -q "$T/remote.git" "$T/w" 2>/dev/null
cd "$T/w"
git checkout -q -b main
git config user.email t@t; git config user.name t
mkdir -p scripts/mini infra/docker-compose
cp "$HERE/redeploy.sh" scripts/mini/redeploy.sh
cat > scripts/mini/up.sh <<'SH'
#!/usr/bin/env bash
echo "up $(git rev-parse --short HEAD)" >> "$QC_T/calls"
[ "$(git rev-parse HEAD)" = "$(cat "$QC_T/up_fails_at" 2>/dev/null)" ] && exit 1
exit 0
SH
cat > scripts/mini/smoke.sh <<'SH'
#!/usr/bin/env bash
[ "$(git rev-parse HEAD)" = "$(cat "$QC_T/smoke_fails_at" 2>/dev/null)" ] && exit 1
exit 0
SH
chmod +x scripts/mini/*.sh
printf 'PON_API_BASE=https://api.example\n' > infra/docker-compose/.env.mini
printf '.env.mini\n' > infra/docker-compose/.gitignore
touch infra/docker-compose/compose.mini.yml infra/docker-compose/Caddyfile.mini
git add -A && git commit -qm c1 && git push -q origin main 2>/dev/null
C1="$(git rev-parse HEAD)"

# Another clone pushes new commits to main, as CI merges would.
git clone -q -b main "$T/remote.git" "$T/pusher" 2>/dev/null
push_commit() { (cd "$T/pusher" && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m "$1" && git push -q origin main 2>/dev/null && git rev-parse HEAD); }

fails=0
check() { if eval "$2"; then echo "  ok: $1"; else echo "  FAIL: $1"; fails=$((fails + 1)); fi; }
calls() { if [ -f "$T/calls" ]; then wc -l < "$T/calls" | tr -d ' '; else echo 0; fi; }
run() { ./scripts/mini/redeploy.sh "$@" >"$T/out" 2>&1; echo $?; }

# 1. main moves to a build that fails smoke → rolled back.
C2="$(push_commit broken)"; echo "$C2" > "$T/smoke_fails_at"
rc="$(run)"
check "a build that fails smoke is rolled back (exit 1, back on c1)" \
  '[ "$rc" = 1 ] && [ "$(git rev-parse HEAD)" = "$C1" ]'

# 2. Nothing new on main: the same broken build must not be redeployed.
before="$(calls)"
rc="$(run)"
check "the rolled-back commit is not redeployed on the next run" \
  '[ "$rc" = 0 ] && [ "$(calls)" = "$before" ] && [ "$(git rev-parse HEAD)" = "$C1" ]'

# 3. A fix lands on main → deployed.
C3="$(push_commit fixed)"
rc="$(run)"
check "a new commit after the broken one is deployed" \
  '[ "$rc" = 0 ] && [ "$(git rev-parse HEAD)" = "$C3" ]'

# 4. up.sh fails (compose refused to start) → that is a failed deploy.
C4="$(push_commit needs-new-var)"; echo "$C4" > "$T/up_fails_at"
rc="$(run)"
check "an up.sh failure rolls back instead of reporting a deploy" \
  '[ "$rc" = 1 ] && [ "$(git rev-parse HEAD)" = "$C3" ] && ! grep -q "✓ deployed" "$T/out"'

# 5. --force still redeploys a commit that was rolled back.
rm -f "$T/up_fails_at"
rc="$(run --force)"
check "--force overrides the remembered broken commit" \
  '[ "$rc" = 0 ] && [ "$(git rev-parse HEAD)" = "$C4" ]'

[ "$fails" -eq 0 ] && echo "redeploy.sh: all checks passed" || { echo "redeploy.sh: $fails check(s) failed"; sed 's/^/    /' "$T/out"; exit 1; }
