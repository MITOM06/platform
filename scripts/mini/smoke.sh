#!/usr/bin/env bash
#
# Asserts that a running PON backend still honours the contracts its clients
# depend on. Takes the base URL as an argument so nothing here names an
# environment — the mini passes PON_API_BASE from .env.mini, CI passes a
# repository variable, and a self-host deployment can point it at its own host.
#
#   ./scripts/mini/smoke.sh https://api.example.com
#
# Exits non-zero naming the first broken contract. Used by redeploy.sh (which
# rolls back on failure) and by .github/workflows/prod-smoke.yml (which runs on
# a schedule, so a deployment that silently drifts from main turns the repo red
# instead of waiting for a user to report it).

set -uo pipefail

BASE="${1:-${PON_API_BASE:-}}"
BASE="${BASE%/}"   # a trailing slash doubles every path below
[ -n "$BASE" ] || { echo "usage: smoke.sh <base-url>   (or set PON_API_BASE)"; exit 2; }

CURL=(curl -sS --max-time 20)
failures=0

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }

fail() { red "  ✗ $1"; failures=$((failures + 1)); }
pass() { grn "  ✓ $1"; }

# --- status-code checks ------------------------------------------------------
# chat-service's actuator sits behind auth, so 401 is the healthy answer there;
# what matters is that something answered, not that it let us in.
check_status() {
  local path="$1" want="$2" label="$3" got
  got="$("${CURL[@]}" -o /dev/null -w '%{http_code}' "$BASE/$path" 2>/dev/null)"
  case " $want " in
    *" $got "*) pass "$label ($got)" ;;
    *)          fail "$label: expected $want, got $got  [$BASE/$path]" ;;
  esac
}

echo "smoke: $BASE"

check_status "_up"                        "200"     "tunnel reachable"
check_status "api/ai/health"              "200"     "ai-service"
check_status "api/connector/catalog"      "200"     "connector-service"
check_status "api/chat/actuator/health"   "200 401" "chat-service answering"

# --- the social-login redirect ----------------------------------------------
# The regression this exists for: Caddy mounts auth-service at /api/auth with
# `handle_path`, which strips the prefix before proxying, so the service cannot
# tell what path the browser used. Without X-Forwarded-Prefix reaching it, the
# init redirect comes back root-relative ('/auth/google'), the browser resolves
# it against the API host root and lands on the ingress 404 — never reaching
# Google. Both the Caddy header and the auth-service side must be live for this
# to pass, and a stale container on either side fails it.
init_path="api/auth/auth/social/google/init?platform=web"
headers="$("${CURL[@]}" -D - -o /dev/null "$BASE/$init_path" 2>/dev/null)"
status="$(printf '%s' "$headers" | awk 'tolower($1) ~ /^http/ {print $2; exit}')"
location="$(printf '%s' "$headers" \
  | awk 'tolower($1) == "location:" {print $2; exit}' | tr -d '\r')"

if [ "$status" != "302" ]; then
  fail "social-login init: expected 302, got ${status:-no response}"
elif [ "${location#/api/auth/auth/google}" = "$location" ]; then
  fail "social-login init redirects to '$location' — expected it to start with
      /api/auth/auth/google. The mount prefix is being dropped: either Caddy is
      not sending X-Forwarded-Prefix (stale container — recreate it, a changed
      bind-mounted Caddyfile does not reach a running one) or auth-service
      predates the fix that reads the header."
else
  pass "social-login init → $location"
fi

echo
if [ "$failures" -gt 0 ]; then
  red "✗ $failures check(s) failed"
  exit 1
fi
grn "✓ all checks passed"
