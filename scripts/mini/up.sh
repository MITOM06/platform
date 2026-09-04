#!/usr/bin/env bash
#
# Brings the PON backend up on the Mac mini behind a Cloudflare Tunnel.
#
# The awkward part this exists to handle: a quick tunnel's hostname is assigned
# by Cloudflare at start time, but four services need to know it before they
# start (OAuth callbacks, the auth-service BASE_URL). So the tunnel comes up
# first, its name is read out of cloudflared's own logs, written back into
# .env.mini, and only then does the rest of the stack start.
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
  val="$(grep -E "^$key=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)"
  [ -z "$val" ] && missing="${missing}  - $key
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

# ── 1. tunnel first ─────────────────────────────────────────────────────────
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

# ── 2. persist it, then start the rest ──────────────────────────────────────
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

code="$(curl -s -o /dev/null -w '%{http_code}' "$URL/_up" || echo 000)"
[ "$code" = "200" ] && grn "✓ reachable through the tunnel ($URL/_up → 200)" \
                    || ylw "! tunnel returned $code — Cloudflare can take ~30s to propagate"

WEB_ORIGIN="$(grep -E '^WEB_ORIGIN=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
HOST="${URL#https://}"

cat <<EOF

────────────────────────────────────────────────────────────────────────────
  Backend is live at  $URL

  This hostname is new — a quick tunnel gets a fresh one every start. Three
  places hold a copy of it and all three need updating now.

  1) VERCEL — set these five, then redeploy (env changes need a new build):

     NEXT_PUBLIC_AUTH_URL=$URL/api/auth
     NEXT_PUBLIC_CHAT_URL=$URL/api/chat
     NEXT_PUBLIC_CONNECTOR_URL=$URL/api/connector
     NEXT_PUBLIC_AI_URL=$URL/api/ai
     NEXT_PUBLIC_WS_URL=wss://$HOST/ws

     NEXT_PUBLIC_WS_URL is not optional here: without it the client derives
     wss://<vercel-host>/ws, and Vercel does not serve the socket.

     With the Vercel CLI, from apps/web:
       for v in AUTH:api/auth CHAT:api/chat CONNECTOR:api/connector AI:api/ai; do
         n=NEXT_PUBLIC_\${v%%:*}_URL
         vercel env rm \$n production -y 2>/dev/null
         echo "$URL/\${v#*:}" | vercel env add \$n production
       done
       vercel env rm NEXT_PUBLIC_WS_URL production -y 2>/dev/null
       echo "wss://$HOST/ws" | vercel env add NEXT_PUBLIC_WS_URL production
       vercel --prod

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
