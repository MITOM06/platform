#!/usr/bin/env bash
#
# A smoke check that cannot fail is decoration. These tests stand up a stub
# backend and assert smoke.sh catches the exact regression it exists for: the
# social-login init redirect losing its mount prefix.
set -uo pipefail
cd "$(dirname "$0")"

PORT=8079
STUB="$(mktemp -d)"
cleanup() { [ -n "${STUB_PID:-}" ] && kill "$STUB_PID" 2>/dev/null; wait "${STUB_PID:-}" 2>/dev/null; rm -rf "$STUB"; }
trap cleanup EXIT

# MODE is read per-request from a file so one server can serve both cases.
cat > "$STUB/stub.py" <<'PY'
import sys, os
from http.server import BaseHTTPRequestHandler, HTTPServer

MODE_FILE = sys.argv[2]

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        mode = open(MODE_FILE).read().strip()
        if self.path.startswith('/api/auth/auth/social/google/init'):
            # 'broken' reproduces the pre-fix behaviour: a root-relative target
            # that resolves against the host root and 404s before reaching Google.
            loc = '/auth/google?platform=web' if mode == 'broken' \
                  else '/api/auth/auth/google?platform=web'
            self.send_response(302)
            self.send_header('Location', loc)
            self.end_headers()
            return
        self.send_response(401 if 'actuator' in self.path else 200)
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, *a): pass

HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
PY

printf 'healthy' > "$STUB/mode"
python3 "$STUB/stub.py" "$PORT" "$STUB/mode" 2>/dev/null &
STUB_PID=$!
for _ in $(seq 1 40); do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/_up" && break
  sleep 0.1
done

fails=0
expect() { # expect <exit-code> <label>
  local want="$1" label="$2"
  ./smoke.sh "http://127.0.0.1:$PORT" >"$STUB/out" 2>&1
  local got=$?
  if [ "$got" = "$want" ]; then
    echo "  ok: $label"
  else
    echo "  FAIL: $label — expected exit $want, got $got"; sed 's/^/      /' "$STUB/out"
    fails=$((fails + 1))
  fi
}

printf 'healthy' > "$STUB/mode"
expect 0 "passes when the redirect carries the /api/auth prefix"

printf 'broken'  > "$STUB/mode"
expect 1 "fails when the redirect loses the prefix (the #143 regression)"

# The failure has to name the culprit, not just say 'failed' — that message is
# the whole value when this fires at 3am.
./smoke.sh "http://127.0.0.1:$PORT" >"$STUB/out" 2>&1
if grep -q "X-Forwarded-Prefix" "$STUB/out"; then
  echo "  ok: failure message points at the mount prefix"
else
  echo "  FAIL: failure message does not mention X-Forwarded-Prefix"; fails=$((fails + 1))
fi

# A missing base URL is a usage error (2), distinct from a failed check (1), so
# a misconfigured caller is never mistaken for a broken deployment.
( unset PON_API_BASE; ./smoke.sh >/dev/null 2>&1 )
[ $? = 2 ] && echo "  ok: missing base URL exits 2, not 1" \
           || { echo "  FAIL: missing base URL did not exit 2"; fails=$((fails + 1)); }

# An unreachable host must fail, not pass by reading an empty response as fine.
./smoke.sh "http://127.0.0.1:1" >/dev/null 2>&1
[ $? = 1 ] && echo "  ok: unreachable host fails" \
           || { echo "  FAIL: unreachable host did not fail"; fails=$((fails + 1)); }

[ "$fails" = 0 ] && { echo "PASS"; exit 0; } || { echo "FAIL ($fails)"; exit 1; }
