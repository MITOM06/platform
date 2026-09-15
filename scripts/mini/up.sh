#!/usr/bin/env bash
#
# Brings the PON backend up on the Mac mini behind a Cloudflare Tunnel.
#
# Two tunnel modes, chosen by whether CF_TUNNEL_TOKEN is set in .env.mini:
#
#   named — the mini's mode. The hostname was routed once in the Cloudflare
#     dashboard and never changes, so PON_API_BASE is a constant in .env.mini
#     and a restart re-points nothing.
#
#   quick — no account, no DNS, but Cloudflare assigns the hostname at start
#     time and four services need to know it before they start (OAuth
#     callbacks, the auth-service BASE_URL). So the tunnel comes up first, its
#     name is read out of cloudflared's own logs, written back into .env.mini,
#     and only then does the rest of the stack start.
#
#   ./scripts/mini/up.sh            # pull latest images, bring everything up
#   ./scripts/mini/up.sh --no-pull  # reuse what is already on the mini
#   ./scripts/mini/up.sh --down     # stop and remove the stack
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$ROOT/infra/docker-compose"
ENV_FILE="$DIR/.env.mini"
# An explicit project name: the dev stack in this same directory would otherwise
# share the default one (derived from the folder) and the two would fight over
# container and network names.
COMPOSE=(docker compose -p pon-mini -f "$DIR/compose.mini.yml" --env-file "$ENV_FILE")

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }
die()  { red "✗ $*"; exit 1; }

# Read one key out of .env.mini. Values are taken verbatim after the first '='
# so tokens containing '=' survive.
env_val() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-; }

PULL=1
case "${1:-}" in
  --no-pull) PULL=0 ;;
  --down)    "${COMPOSE[@]}" down && grn "✓ stack stopped"; exit 0 ;;
  "")        ;;
  *)         die "unknown flag: $1 (--no-pull | --down)" ;;
esac

# ── preflight ───────────────────────────────────────────────────────────────
docker info >/dev/null 2>&1 || die "Docker is not running. Open Docker Desktop first."
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found. Start from the template:
    cp $DIR/.env.mini.example $ENV_FILE"

# Report every blank required value at once. Compose would abort on the first
# one it interpolates, which turns filling in the file into a guessing loop.
missing=""
for key in MONGODB_URI REDIS_URL RABBITMQ_HOST RABBITMQ_USERNAME RABBITMQ_PASSWORD \
           RABBITMQ_VHOST RABBITMQ_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET \
           SESSION_SECRET CONNECTOR_VAULT_KEY INTERNAL_API_KEY ANTHROPIC_API_KEY \
           WEB_ORIGIN; do
  [ -z "$(env_val "$key")" ] && missing="${missing}  - $key
"
done
if [ -n "$missing" ]; then
  red "✗ these are still blank in .env.mini:"
  printf '%s' "$missing"
  echo "  They are the values deploy.yml fed Cloud Run — see the comments in"
  echo "  .env.mini.example for where each one comes from."
  exit 1
fi

if grep -qE '^RABBITMQ_VHOST=/$' "$ENV_FILE"; then
  die "RABBITMQ_VHOST is '/'. CloudAMQP gives a named vhost; publishing into '/'
    reaches a vhost with no consumers and the assistant goes silent with no error."
fi

CF_TOKEN="$(env_val CF_TUNNEL_TOKEN)"
CONFIGURED_BASE="$(env_val PON_API_BASE)"
CONFIGURED_BASE="${CONFIGURED_BASE%/}"   # a trailing slash doubles every path

# ── 1. the tunnel ───────────────────────────────────────────────────────────
if [ -n "$CF_TOKEN" ]; then
  MODE=named
  case "$CONFIGURED_BASE" in
    https://*) ;;
    *) die "CF_TUNNEL_TOKEN is set, so this is a named tunnel and the hostname
    has to be the one you routed in the Cloudflare dashboard:

        PON_API_BASE=https://api.example.com

    found: '${CONFIGURED_BASE:-<blank>}'" ;;
  esac
  # A named tunnel's hostname is known before anything starts, so unlike the
  # quick path there is no two-phase dance here: everything comes up at once.
  export CF_TUNNEL_COMMAND="tunnel --no-autoupdate run --token $CF_TOKEN"
  URL="$CONFIGURED_BASE"
  [ "$PULL" = 1 ] && { ylw "→ pulling images…"; "${COMPOSE[@]}" pull -q || die "pull failed"; }
  ylw "→ starting stack (named tunnel → $URL)…"
  "${COMPOSE[@]}" up -d || die "compose up failed — ${COMPOSE[*]} logs"
else
  MODE=quick
  # Compose interpolates the whole file even when starting a subset of services,
  # so PON_API_BASE has to hold *something* here. A shell variable outranks the
  # --env-file, so this placeholder never touches .env.mini.
  export PON_API_BASE="${PON_API_BASE:-https://pending.invalid}"

  [ "$PULL" = 1 ] && { ylw "→ pulling images…"; "${COMPOSE[@]}" pull -q caddy cloudflared || die "pull failed"; }
  ylw "→ starting tunnel…"
  "${COMPOSE[@]}" up -d caddy cloudflared || die "could not start caddy/cloudflared"

  ylw "→ waiting for Cloudflare to assign a hostname…"
  # Resolve the container once and read it with `docker logs`: `compose logs`
  # re-reads the whole project on every call and turns a 5-second wait into a
  # minute of polling overhead.
  CF="$("${COMPOSE[@]}" ps -q cloudflared)"
  [ -n "$CF" ] || die "cloudflared container did not start"
  URL=""
  for _ in $(seq 1 40); do
    URL="$(docker logs "$CF" 2>&1 \
          | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)"
    [ -n "$URL" ] && break
    sleep 2
  done
  [ -n "$URL" ] || die "no tunnel hostname after 80s. Check: docker logs $CF"
  grn "✓ tunnel: $URL"

  # ── persist it, then start the rest ──────────────────────────────────────
  # BSD sed on macOS needs the empty -i argument; the mini is macOS by definition.
  if grep -qE '^PON_API_BASE=' "$ENV_FILE"; then
    sed -i '' "s|^PON_API_BASE=.*|PON_API_BASE=$URL|" "$ENV_FILE"
  else
    printf '\nPON_API_BASE=%s\n' "$URL" >> "$ENV_FILE"
  fi
  unset PON_API_BASE   # from here on the file is the source of truth

  [ "$PULL" = 1 ] && { ylw "→ pulling service images…"; "${COMPOSE[@]}" pull -q || die "pull failed"; }
  ylw "→ starting services…"
  "${COMPOSE[@]}" up -d || die "compose up failed — ${COMPOSE[*]} logs"
fi

# ── 2. health ───────────────────────────────────────────────────────────────
ylw "→ waiting for health…"
for _ in $(seq 1 60); do
  unhealthy="$("${COMPOSE[@]}" ps --format '{{.Service}} {{.Health}}' 2>/dev/null \
              | awk '$2 != "healthy" && $2 != "" {print $1}')"
  [ -z "$unhealthy" ] && break
  sleep 3
done
if [ -n "${unhealthy:-}" ]; then
  red "✗ not healthy: $unhealthy"
  echo "  ${COMPOSE[*]} logs --tail=40 $unhealthy"
else
  grn "✓ all services healthy"
fi

# `|| echo 000` would append to whatever curl already wrote, so the code is
# defaulted afterwards instead.
code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$URL/_up" 2>/dev/null)"
code="${code:-000}"
[ "$code" = "200" ] && grn "✓ reachable through the tunnel ($URL/_up → 200)" \
                    || ylw "! tunnel returned $code — Cloudflare can take ~30s to propagate"

WEB_ORIGIN="$(env_val WEB_ORIGIN)"
HOST="${URL#https://}"

# ── 3. what now holds a copy of the hostname ────────────────────────────────
if [ "$MODE" = named ]; then
  cat <<EOF

────────────────────────────────────────────────────────────────────────────
  Backend is live at  $URL
  Named tunnel: this hostname is permanent. Restarting the mini — or losing
  power — brings the stack back on the same address, so nothing below has to
  be redone. It is here for the first run and for a hostname change.

  1) VERCEL — one variable, then redeploy (env changes need a build):

       NEXT_PUBLIC_API_BASE=$URL

     apps/web/lib/config/env.ts derives every base URL from it — /api/auth,
     /api/chat, /api/ai, /api/connector and wss://$HOST/ws.

     If the old five NEXT_PUBLIC_*_URL variables are still set in the project,
     remove them: a per-service variable wins over the base and will pin the
     app to whatever host it names.

  2) FLUTTER — build against this host once:

       flutter build apk --dart-define=PON_DOMAIN=$HOST

  3) OAUTH CONSOLES — register these once and never again:

       $URL/api/auth/auth/google/callback
       $URL/api/auth/auth/x/callback
       $URL/api/connector/oauth/notion/callback
       $URL/api/connector/oauth/gmail/callback
       $URL/api/connector/oauth/calendar/callback

  Web app: $WEB_ORIGIN
  Logs:    docker compose -p pon-mini -f infra/docker-compose/compose.mini.yml logs -f
────────────────────────────────────────────────────────────────────────────
EOF
else
  cat <<EOF

────────────────────────────────────────────────────────────────────────────
  Backend is live at  $URL

  This hostname is new — a quick tunnel gets a fresh one every start. Three
  places hold a copy of it and all three need updating now. Setting
  CF_TUNNEL_TOKEN in .env.mini switches to a named tunnel and ends this.

  1) VERCEL — set this one variable, then redeploy (env changes need a build):

     NEXT_PUBLIC_API_BASE=$URL

     apps/web/lib/config/env.ts derives every base URL from it — /api/auth,
     /api/chat, /api/ai, /api/connector and wss://$HOST/ws — exactly the routes
     Caddyfile.mini serves. The old five NEXT_PUBLIC_*_URL variables still work
     and still win individually, but you no longer have to keep five copies of
     one hostname in sync.

     With the Vercel CLI, from apps/web:
       vercel env rm NEXT_PUBLIC_API_BASE production -y 2>/dev/null
       echo "$URL" | vercel env add NEXT_PUBLIC_API_BASE production
       vercel --prod

     If the five old variables are still set in the project, remove them —
     they override NEXT_PUBLIC_API_BASE and will pin the app to a dead tunnel:
       for n in AUTH CHAT CONNECTOR AI; do
         vercel env rm NEXT_PUBLIC_\${n}_URL production -y 2>/dev/null
       done
       vercel env rm NEXT_PUBLIC_WS_URL production -y 2>/dev/null

  2) FLUTTER — rebuild against this host:

       flutter build apk --dart-define=PON_DOMAIN=$HOST

  3) OAUTH CONSOLES — re-register the redirect URIs. Google rejects wildcards,
     so this is manual every time the hostname changes:

       $URL/api/auth/auth/google/callback
       $URL/api/auth/auth/x/callback
       $URL/api/connector/oauth/notion/callback
       $URL/api/connector/oauth/gmail/callback
       $URL/api/connector/oauth/calendar/callback

     Until they are updated, social login and connector OAuth fail with
     redirect_uri_mismatch. Everything else — email login, chat, AI — works.

  Web app: $WEB_ORIGIN
  Logs:    docker compose -p pon-mini -f infra/docker-compose/compose.mini.yml logs -f
────────────────────────────────────────────────────────────────────────────
EOF
fi
