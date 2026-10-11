#!/usr/bin/env bash
#
# Keeps the promotion path honest: local → production must be a configuration
# change, and a configuration change must be *complete*.
#
# Three ways that quietly stops being true, each of which has cost us a live
# incident or a dead deployment:
#
#   1. A deployment file requires a variable that its own example file never
#      mentions, so whoever fills the example ships a broken deployment.
#   2. A production deployment carries a development fallback, so a missing
#      secret produces a green deploy wired to the wrong thing (a RabbitMQ vhost
#      defaulted to '/' once made the assistant silently stop answering).
#   3. The web app reads a NEXT_PUBLIC_* variable nobody documented, so it is
#      simply absent in production and the feature is dead there only.
#   4. A deployment hands a service an EMPTY value or leaves out a variable the
#      service refuses to boot without — the self-host stack once crashed on boot
#      in three services at once (2026-10-11) while every check here was green.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail=0
problem() {
  printf '\033[31m✗ %s\033[0m\n' "$1"
  shift
  printf '    %s\n' "$@"
  fail=1
}

# ── 1. Required variables are documented in the matching example file ────────
# `${VAR:?...}` in a compose file means "refuse to start without this".
check_required_documented() {
  local compose="$1" example="$2" missing=()
  [ -f "$compose" ] && [ -f "$example" ] || return 0
  while IFS= read -r var; do
    grep -qE "^#? *${var}=" "$example" || missing+=("$var")
  done < <(grep -oE '\$\{[A-Z_][A-Z0-9_]*:\?' "$compose" | sed 's/^\${//; s/:?$//' | sort -u)
  if [ "${#missing[@]}" -gt 0 ]; then
    problem "$compose requires variables that $example does not list:" "${missing[@]}"
  fi
}
check_required_documented infra/docker-compose/compose.mini.yml infra/docker-compose/.env.mini.example
check_required_documented infra/docker-compose/compose.prod.yml infra/docker-compose/.env.example
check_required_documented infra/livekit/compose.livekit.yml infra/livekit/.env.livekit.example

# ── 2. No development fallback in a production deployment ────────────────────
# A loopback address, or the well-known local broker credentials, reached from a
# file that only ever runs in production.
for f in .github/workflows/deploy.yml infra/docker-compose/compose.mini.yml infra/docker-compose/compose.prod.yml; do
  [ -f "$f" ] || continue
  # `|| 'value'` (Actions) and `:-value` (compose) are the two fallback forms.
  # grep -n prefixes "NN:", so the comment filter has to skip past it.
  hits="$(grep -nE "(\|\| *'[^']*(localhost|127\.0\.0\.1|platform)[^']*')|(:-[^}]*(localhost|127\.0\.0\.1)[^}]*\})" "$f" \
          | grep -vE '^[0-9]+:[[:space:]]*#' || true)"
  if [ -n "$hits" ]; then
    problem "$f has a development fallback in a production deployment:" "$hits"
  fi
done

# ── 3. Every NEXT_PUBLIC_* the web app reads is documented ───────────────────
if [ -d apps/web ]; then
  undocumented=()
  while IFS= read -r var; do
    grep -qE "^#? *${var}=" apps/web/.env.example || undocumented+=("$var")
  done < <(git grep -hoE 'process\.env\.NEXT_PUBLIC_[A-Z0-9_]+' -- 'apps/web/**/*.ts' 'apps/web/**/*.tsx' \
           | sed 's/^process\.env\.//' | sort -u)
  if [ "${#undocumented[@]}" -gt 0 ]; then
    problem "apps/web reads NEXT_PUBLIC_* variables that .env.example does not list:" "${undocumented[@]}"
  fi
fi

# ── 4. Boot-critical variables are present and never handed over empty ───────
# Spring resolves `${X:default}` to "" when X is set but empty, so an empty
# compose default (`${SPRING_..._URL:-}`) overrides application.yml's fallback.
# Node services treat "" as unset; Spring does not. Addresses only: an empty
# SPRING_MAIL_HOST just means "no mail", which is a valid choice.
for f in infra/docker-compose/compose.mini.yml infra/docker-compose/compose.prod.yml; do
  [ -f "$f" ] || continue
  hits="$(grep -nE 'SPRING_[A-Z0-9_]+_(URL|URI): *\$\{[A-Z0-9_]+:-\}' "$f" | grep -vE '^[0-9]+:[[:space:]]*#' || true)"
  if [ -n "$hits" ]; then
    problem "$f hands Spring an empty value (it overrides application.yml's default):" "$hits"
  fi
done

# The variables each service's production boot guard refuses to start without
# (auth main.ts; the rest have container-name defaults in these files).
service_block() { # service_block <compose> <service> → that service's lines
  awk -v svc="  $2:" '$0 == svc {on=1; next} on && /^  [a-z0-9-]+:$/ {exit} on {print}' "$1"
}
for f in infra/docker-compose/compose.mini.yml infra/docker-compose/compose.prod.yml; do
  [ -f "$f" ] || continue
  block="$(service_block "$f" auth-service)"
  missing=()
  for var in WEB_REDIRECT_URL CORS_ORIGINS SESSION_SECRET JWT_ACCESS_SECRET; do
    printf '%s\n' "$block" | grep -qE "^ +${var}:" || missing+=("$var")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    problem "$f: auth-service refuses to boot in production without:" "${missing[@]}"
  fi
done

if [ "$fail" -eq 0 ]; then
  printf '\033[32m✓\033[0m dev and production configuration are in parity\n'
fi
exit "$fail"
