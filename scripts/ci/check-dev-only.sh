#!/usr/bin/env bash
#
# Enforces .claude/rules/dev-local-only.md: local bring-up tooling, fake data and
# loosened platform policies live on `dev` and must never reach `main`.
#
# Most of them are scoped by construction — Android's cleartext switch sits in
# src/debug/, the web dev URLs sit in a gitignored file. Two are not: iOS
# Info.plist ships with release builds, and a seed script is an ordinary tracked
# file. Those rely on a human noticing during promotion, which is exactly the
# kind of thing that gets noticed four times and missed the fifth.
#
# On main this fails. On any other branch it reports what would block a
# promotion, and exits 0 — `dev` is supposed to carry these.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# In Actions: GITHUB_BASE_REF for pull_request, GITHUB_REF_NAME for push.
branch="${GITHUB_BASE_REF:-${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}}"

found=""
note() { found="${found}  - $1
"; }

# 1. ATS relaxation — cannot be scoped to a debug build, ships with release.
if git grep -qI 'NSAllowsLocalNetworking' -- apps/client/ios/Runner/Info.plist 2>/dev/null; then
  note "apps/client/ios/Runner/Info.plist: NSAllowsLocalNetworking (dev-only ATS relaxation)"
fi
# 2. Cleartext HTTP for a real device against the plain-http local stack.
if git ls-files --error-unmatch apps/client/android/app/src/debug/AndroidManifest.xml >/dev/null 2>&1; then
  note "apps/client/android/app/src/debug/AndroidManifest.xml: usesCleartextTraffic (dev-only)"
fi
# 3. Local bring-up tooling and seeded test accounts.
for path in scripts/dev/up.sh scripts/dev/seed-users.js scripts/dev/seed-chat.js; do
  if git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
    note "$path: local bring-up / fake seed data"
  fi
done
# 4. Any environment file pinning the app to a developer's machine.
while IFS= read -r f; do
  [ -n "$f" ] && note "$f: tracked local env file (must stay gitignored)"
done < <(git ls-files '*.development.local' '*.env.local' 2>/dev/null)

if [ -z "$found" ]; then
  printf '\033[32m✓\033[0m no dev-only artefacts tracked (branch: %s)\n' "$branch"
  exit 0
fi

if [ "$branch" = "main" ]; then
  printf '\033[31m✗ dev-only artefacts on main:\033[0m\n%s' "$found"
  cat <<'MSG'
  These belong on `dev` only — see .claude/rules/dev-local-only.md. A promotion
  replays feature commits onto main and drops the env commits:
    git rebase --onto origin/main dev feat/x
    git diff origin/main...feat/x --stat    # must list ONLY the feature's files
MSG
  exit 1
fi

printf '\033[33m!\033[0m dev-only artefacts present (fine on %s, would block main):\n%s' "$branch" "$found"
