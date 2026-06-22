#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp .env.example "$TMP/.env.example"

# Run bootstrap against the temp dir.
ENV_DIR="$TMP" ./bootstrap.sh --no-validate >/dev/null 2>&1 || true
test -f "$TMP/.env" || { echo "FAIL: .env not created"; exit 1; }

get() { grep -E "^$1=" "$TMP/.env" | head -1 | cut -d= -f2-; }
J1="$(get JWT_ACCESS_SECRET)"; V1="$(get CONNECTOR_VAULT_KEY)"; I1="$(get INTERNAL_API_KEY)"
[ -n "$J1" ] && [ -n "$V1" ] && [ -n "$I1" ] || { echo "FAIL: secrets not generated"; exit 1; }

# Vault key must base64-decode to exactly 32 bytes.
LEN="$(printf '%s' "$V1" | base64 -d 2>/dev/null | wc -c | tr -d ' ')"
[ "$LEN" = "32" ] || { echo "FAIL: vault key not 32 bytes (got $LEN)"; exit 1; }

# Idempotency: a second run must NOT change existing secrets.
ENV_DIR="$TMP" ./bootstrap.sh --no-validate >/dev/null 2>&1 || true
[ "$(get JWT_ACCESS_SECRET)" = "$J1" ] || { echo "FAIL: JWT secret changed on re-run"; exit 1; }
[ "$(get CONNECTOR_VAULT_KEY)" = "$V1" ] || { echo "FAIL: vault key changed on re-run"; exit 1; }

# Absent-key case: delete INTERNAL_API_KEY line entirely, re-run, assert it is restored.
if command -v gsed >/dev/null 2>&1; then
  gsed -i "/^INTERNAL_API_KEY=/d" "$TMP/.env"
else
  sed -i '' "/^INTERNAL_API_KEY=/d" "$TMP/.env" 2>/dev/null || sed -i "/^INTERNAL_API_KEY=/d" "$TMP/.env"
fi
grep -qE "^INTERNAL_API_KEY=" "$TMP/.env" && { echo "FAIL: INTERNAL_API_KEY not deleted (test setup)"; exit 1; }
ENV_DIR="$TMP" ./bootstrap.sh --no-validate >/dev/null 2>&1 || true
I2="$(get INTERNAL_API_KEY)"
[ -n "$I2" ] || { echo "FAIL: INTERNAL_API_KEY not appended when key was absent"; exit 1; }

echo "PASS"
