#!/usr/bin/env bash
#
# Fails when a production hostname is hardcoded in application source.
#
# Environment addresses belong in configuration, not in code. A hardcoded prod
# host is invisible when you run locally — it just quietly talks to production.
# That is exactly how mobile social login kept hitting the live auth-service
# while the rest of the app ran against a local stack.
#
# A few files are *supposed* to name the production hosts: the single source of
# truth for each client's defaults, and the image-optimizer allow-list. They are
# listed below; everything else is a leak.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# Cloud Run service hosts + the deployed web origin.
# Any Cloud Run host (they come in several shapes: <svc>-<project>.<region>.run.app
# and <svc>-<hash>-<region>.a.run.app) plus the deployed web origin. Requires a
# real label before '.run.app', so a comment saying '*.run.app' does not trip it.
PATTERN='[0-9a-z][0-9a-z.-]*\.run\.app|platform-web-omega-amber\.vercel\.app'

# Nothing is exempt any more. Both files that used to be were the *reason* for
# this check: app_config.dart's Cloud Run defaults meant a Flutter build with no
# --dart-define talked to production, and next.config.ts pinned the image
# optimizer to two hostnames that have since been retired. Both now derive the
# host from configuration, so a new entry here means a new leak.
ALLOWED=()

# bash 3.2 (the macOS default) has no mapfile, so collect into a temp file.
hits="$(mktemp)"
trap 'rm -f "$hits"' EXIT

git ls-files \
    '*.ts' '*.tsx' '*.js' '*.jsx' '*.dart' '*.java' '*.kt' '*.swift' '*.yml' '*.yaml' \
  | grep -vE '^(\.github/|infra/|docs/|scripts/ci/)' \
  | tr '\n' '\0' \
  | xargs -0 grep -nEI "$PATTERN" 2>/dev/null \
  | while IFS= read -r hit; do
      file="${hit%%:*}"
      for allowed in ${ALLOWED[@]+"${ALLOWED[@]}"}; do
        [ "$file" = "$allowed" ] && continue 2
      done
      printf '%s\n' "$hit"
    done > "$hits"

leak_count="$(wc -l < "$hits" | tr -d ' ')"

if [ "$leak_count" -gt 0 ]; then
  printf '\033[31m✗ hardcoded production host in source:\033[0m\n'
  sed 's/^/  /' "$hits"
  cat <<'MSG'

  Read the address from configuration instead:
    Flutter → AppConfig.<service>BaseUrl   (never String.fromEnvironment directly)
    web     → process.env.NEXT_PUBLIC_*    (set per environment, not per build)
    server  → ConfigService / env var, with a dev-only fallback

  If this file legitimately has to name the host, add it to ALLOWED in
  scripts/ci/check-env-leaks.sh with a comment saying why.
MSG
  exit 1
fi

printf '\033[32m✓\033[0m no hardcoded production hosts in source\n'
