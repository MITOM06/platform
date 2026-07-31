#!/usr/bin/env bash
#
# One-shot local dev bring-up. Assumes Docker Desktop is already running.
#
#   ./scripts/dev/up.sh                 # start everything (build only if image missing)
#   ./scripts/dev/up.sh --build         # force-rebuild the 4 backend images first
#   ./scripts/dev/up.sh --seed          # (re)seed the fake test data
#   ./scripts/dev/up.sh --no-web        # backends only, don't start the Next.js dev server
#   ./scripts/dev/up.sh --flutter       # also boot an iOS simulator and run the Flutter app
#
# Flags combine. Everything here is idempotent — safe to re-run.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT/infra/docker-compose/compose.yml"
SIMULATOR="${PON_SIMULATOR:-iPhone 17 Pro}"

DO_BUILD=0 DO_SEED=0 DO_WEB=1 DO_FLUTTER=0
for arg in "$@"; do
  case "$arg" in
    --build)   DO_BUILD=1 ;;
    --seed)    DO_SEED=1 ;;
    --no-web)  DO_WEB=0 ;;
    --flutter) DO_FLUTTER=1 ;;
    -h|--help) sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $arg (try --help)" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

# --------------------------------------------------------------- preflight
step "Preflight"
docker info >/dev/null 2>&1 || die "Docker isn't running — start Docker Desktop first."
ok "docker daemon up"
[ -f "$ROOT/apps/server/auth-service/.env" ] || die "missing apps/server/auth-service/.env"
# JWT_ACCESS_SECRET must be identical across services; compose reads it from the
# root env, so export it from auth-service's .env when it isn't already set.
if [ -z "${JWT_ACCESS_SECRET:-}" ]; then
  JWT_ACCESS_SECRET="$(grep -E '^JWT_ACCESS_SECRET=' "$ROOT/apps/server/auth-service/.env" | head -1 | cut -d= -f2-)"
  export JWT_ACCESS_SECRET
fi
[ -n "${JWT_ACCESS_SECRET:-}" ] || die "JWT_ACCESS_SECRET not set and not found in auth-service/.env"
ok "JWT_ACCESS_SECRET resolved"

# ------------------------------------------------------------------ build
if [ "$DO_BUILD" = 1 ]; then
  step "Rebuilding backend images (Maven build for chat-service takes a few minutes)"
  $COMPOSE build auth-service chat-service ai-service connector-service
  ok "images rebuilt"
fi

# ------------------------------------------------------------------- boot
step "Starting containers"
$COMPOSE up -d
ok "compose up"

# ------------------------------------------------- wait for health + repair
# `ai.requests` is declared with a 30s TTL + DLX. A queue left behind by an
# older build without those arguments makes ai-service fail QueueDeclare with
# 406 PRECONDITION_FAILED and crash-loop forever. The queue is a job queue, so
# dropping it is safe: delete it and let the current code redeclare it.
fix_ai_queue() {
  local args
  args="$(docker exec chat-rabbitmq rabbitmqctl list_queues name arguments 2>/dev/null \
          | awk '$1 == "ai.requests" { $1=""; print }' || true)"
  if [ -n "$args" ] && ! printf '%s' "$args" | grep -q 'x-message-ttl'; then
    warn "ai.requests exists without x-message-ttl (stale) — recreating"
    docker exec chat-rabbitmq rabbitmqctl delete_queue ai.requests >/dev/null 2>&1 || true
    docker restart ai-service >/dev/null
    ok "ai-service restarted"
  fi
}

wait_http() {
  local name=$1 url=$2 want=$3 tries=${4:-60} code
  printf '  waiting for %-18s' "$name"
  for _ in $(seq 1 "$tries"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$url" || true)"
    case " $want " in *" $code "*) printf ' \033[32m%s\033[0m\n' "$code"; return 0 ;; esac
    printf '.'
    sleep 2
  done
  printf ' \033[31mtimeout (last=%s)\033[0m\n' "$code"
  return 1
}

step "Waiting for services"
wait_http auth-service      http://localhost:3001/health           200      || die "auth-service never came up — docker logs auth-service"
wait_http connector-service http://localhost:3003/health           200      || warn "connector-service not responding (MCP/skills off)"
# Actuator is secured, so 401 means Spring booted and is serving.
wait_http chat-service      http://localhost:8080/actuator/health  "200 401" 90 \
  || die "chat-service never came up — docker logs chat-service (ALLOWED_ORIGINS / Mongo?)"
sleep 3
fix_ai_queue
wait_http ai-service        http://localhost:3002/health           200      || warn "ai-service not responding — docker logs ai-service"

# ------------------------------------------------------------------- seed
if [ "$DO_SEED" = 1 ]; then
  step "Seeding fake test data"
  node "$ROOT/scripts/dev/seed-users.js"
  docker exec -i chat-mongo mongosh platform --quiet < "$ROOT/scripts/dev/seed-chat.js" \
    | grep -vE '^\s*$' | sed 's/^[^>]*> //'
  ok "seeded"
fi

# -------------------------------------------------------------------- web
if [ "$DO_WEB" = 1 ]; then
  step "Starting Next.js dev server"
  if curl -s -o /dev/null --max-time 3 http://localhost:3000/login; then
    ok "already running on :3000"
  else
    [ -f "$ROOT/apps/web/.env.development.local" ] \
      || warn "apps/web/.env.development.local missing — web will talk to PROD Cloud Run"
    mkdir -p "$ROOT/.dev-logs"
    (cd "$ROOT" && pnpm web >"$ROOT/.dev-logs/web.log" 2>&1 &)
    wait_http web http://localhost:3000/login "200 307" 45 \
      || warn "web didn't answer — tail .dev-logs/web.log"
  fi
fi

# ----------------------------------------------------------------- flutter
DEFINES=(
  --dart-define=PON_AUTH_URL=http://localhost:3001
  --dart-define=PON_CHAT_URL=http://localhost:8080
  --dart-define=PON_AI_URL=http://localhost:3002
  --dart-define=PON_CONNECTOR_URL=http://localhost:3003
  --dart-define=PON_WS_URL=ws://localhost:8080/ws
)

step "Ready"
cat <<EOF
  web            http://localhost:3000        (log: .dev-logs/web.log)
  auth  :3001    chat  :8080    ai  :3002    connector :3003
  mongo :27018   redis :6379    rabbit :5672 (UI :15672 platform/platform)

  test accounts  dev@pon.local / alice@pon.local / bob@pon.local
                 password: Devpass123!   (only exist after --seed)

  flutter:
    cd apps/client && flutter run -d "$SIMULATOR" \\
      ${DEFINES[*]}

  a physical device can't reach localhost — swap in your LAN IP:
    $(ipconfig getifaddr en0 2>/dev/null || echo '<your-lan-ip>')

  stop everything:  $COMPOSE down
EOF

if [ "$DO_FLUTTER" = 1 ]; then
  step "Launching Flutter on $SIMULATOR"
  udid="$(xcrun simctl list devices available 2>/dev/null \
          | grep -F "$SIMULATOR (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')"
  [ -n "$udid" ] || die "simulator \"$SIMULATOR\" not found — xcrun simctl list devices available"
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true
  open -a Simulator
  cd "$ROOT/apps/client" && exec flutter run -d "$udid" "${DEFINES[@]}"
fi
