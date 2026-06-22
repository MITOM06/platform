#!/usr/bin/env bash
# PON self-host bootstrap: create .env, generate missing secrets, validate.
# Idempotent — re-running never overwrites an existing secret.
set -euo pipefail

ENV_DIR="${ENV_DIR:-$(cd "$(dirname "$0")" && pwd)}"
ENV_FILE="$ENV_DIR/.env"
EXAMPLE="$ENV_DIR/.env.example"
VALIDATE=1
[ "${1:-}" = "--no-validate" ] && VALIDATE=0

[ -f "$EXAMPLE" ] || { echo "ERROR: $EXAMPLE not found"; exit 1; }
if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example"
fi

# Fill KEY= only when it is currently blank/absent. $2 is the generator command.
fill_secret() {
  local key="$1" gen="$2" cur
  cur="$(grep -E "^$key=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true)"
  if [ -z "$cur" ]; then
    local val; val="$(eval "$gen")"
    if grep -qE "^$key=" "$ENV_FILE" 2>/dev/null; then
      # Key exists but is blank — replace in place (portable BSD + GNU sed)
      if sed --version >/dev/null 2>&1; then
        sed -i "s|^$key=.*|$key=$val|" "$ENV_FILE"
      else
        sed -i '' "s|^$key=.*|$key=$val|" "$ENV_FILE"
      fi
    else
      # Key is entirely absent — append it
      printf '\n%s=%s\n' "$key" "$val" >> "$ENV_FILE"
    fi
    echo "Generated $key"
  fi
}

fill_secret JWT_ACCESS_SECRET  "openssl rand -hex 32"
fill_secret JWT_REFRESH_SECRET "openssl rand -hex 32"
fill_secret CONNECTOR_VAULT_KEY "openssl rand -base64 32"
fill_secret INTERNAL_API_KEY   "openssl rand -hex 32"

if [ "$VALIDATE" = "1" ]; then
  MISSING=()
  for k in DOMAIN WORKSPACE_NAME BOOTSTRAP_OWNER_EMAIL ANTHROPIC_API_KEY; do
    v="$(grep -E "^$k=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
    [ -z "$v" ] && MISSING+=("$k")
  done
  if [ "${#MISSING[@]}" -gt 0 ]; then
    echo ""
    echo "⚠️  Fill these required values in $ENV_FILE before 'up':"
    printf '   - %s\n' "${MISSING[@]}"
    exit 2
  fi
  echo ""
  echo "✅ .env ready. Next:"
  echo "   docker compose -f compose.prod.yml up -d --build"
fi
