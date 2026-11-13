#!/usr/bin/env bash
#
# A check that cannot fail is decoration. These tests stand up a stub that plays
# both Keycloak and PON's auth-service, and assert check.sh catches each way the
# two drift apart (issuer, redirect URI, self-registration, SSO switched off,
# PON pointing at another IdP), while a guarded-or-not admin console only warns.
set -uo pipefail
cd "$(dirname "$0")"

PORT=8078
BASE="http://127.0.0.1:$PORT"
STUB="$(mktemp -d)"
cleanup() { [ -n "${STUB_PID:-}" ] && kill "$STUB_PID" 2>/dev/null; wait "${STUB_PID:-}" 2>/dev/null; rm -rf "$STUB"; }
trap cleanup EXIT

# MODE is read per request from a file, so one server serves every case.
cat > "$STUB/stub.py" <<'PY'
import sys, json
from urllib.parse import quote
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1])
MODE_FILE = sys.argv[2]
BASE = f'http://127.0.0.1:{PORT}'
ISSUER = f'{BASE}/realms/pon'
CALLBACK = f'{BASE}/api/auth/auth/oidc/callback'

class H(BaseHTTPRequestHandler):
    def send(self, code, body=b'', ctype='text/html', location=None):
        self.send_response(code)
        if location:
            self.send_header('Location', location)
        self.send_header('Content-Type', ctype)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        mode = open(MODE_FILE).read().strip()
        p = self.path
        if p == '/_up':
            return self.send(200, b'ok')
        if p.startswith('/realms/pon/.well-known/openid-configuration'):
            iss = 'http://localhost:8080/realms/pon' if mode == 'wrong-issuer' else ISSUER
            doc = {
                'issuer': iss,
                'authorization_endpoint': f'{iss}/protocol/openid-connect/auth',
                'token_endpoint': f'{iss}/protocol/openid-connect/token',
                # Keycloak repeats endpoint names here; check.sh must read the top-level one.
                'mtls_endpoint_aliases': {'token_endpoint': 'https://elsewhere.example/token'},
            }
            return self.send(200, json.dumps(doc, indent=2).encode(), 'application/json')
        if p.startswith('/realms/pon/protocol/openid-connect/auth'):
            # Like the real realm: no redirect_uri is a 400, and the client
            # requires PKCE — no challenge, no page.
            if 'redirect_uri=' not in p:
                return self.send(400, b'<p>Invalid parameter: redirect_uri</p>')
            if 'code_challenge=' not in p or 'code_challenge_method=S256' not in p:
                return self.send(302, location=CALLBACK + '?error=invalid_request')
            if mode == 'bad-redirect':
                return self.send(400, b'<p>Invalid parameter: redirect_uri</p>')
            form = b'<form id="kc-form-login"></form>'
            if mode == 'registration':
                form += b'<a href="/realms/pon/protocol/openid-connect/registrations?client_id=pon-auth">Register</a>'
            return self.send(200, form)
        if p.startswith('/admin/master/console'):
            return self.send(200, b'admin') if mode == 'admin-open' \
                else self.send(302, location='https://team.cloudflareaccess.com/login')
        if p.startswith('/api/auth/auth/sso/info'):
            on = mode != 'sso-off'
            body = {'enabled': on, 'enforced': False, 'loginUrl': '/auth/oidc/login' if on else None}
            return self.send(200, json.dumps(body).encode(), 'application/json')
        if p.startswith('/api/auth/auth/oidc/login'):
            if mode == 'sso-off':
                return self.send(302, location='https://web.example/oauth-callback?error=SSO_DISABLED')
            iss = 'https://other-idp.example/realms/x' if mode == 'other-idp' else ISSUER
            cb = 'https://wrong.example/cb' if mode == 'bad-callback' else CALLBACK
            loc = f'{iss}/protocol/openid-connect/auth?client_id=pon-auth&redirect_uri={quote(cb, safe="")}&scope=openid'
            return self.send(302, location=loc)
        return self.send(404)

    def log_message(self, *a):
        pass

HTTPServer(('127.0.0.1', PORT), H).serve_forever()
PY

printf 'good' > "$STUB/mode"
python3 "$STUB/stub.py" "$PORT" "$STUB/mode" 2>/dev/null &
STUB_PID=$!
for _ in $(seq 1 40); do
  curl -s -o /dev/null "$BASE/_up" && break
  sleep 0.1
done

fails=0
expect() { # expect <exit-code> <mode> <label>
  local want="$1" mode="$2" label="$3"
  printf '%s' "$mode" > "$STUB/mode"
  ./check.sh "$BASE" "$BASE" >"$STUB/out" 2>&1
  local got=$?
  if [ "$got" = "$want" ]; then
    echo "  ok: $label"
  else
    echo "  FAIL: $label — expected exit $want, got $got"; sed 's/^/      /' "$STUB/out"
    fails=$((fails + 1))
  fi
}

expect 0 good         "passes when Keycloak and PON agree"
expect 1 wrong-issuer "fails when the announced issuer is not <sso>/realms/pon"
# ...and says which issuer it got: that value is what goes into OIDC_ISSUER.
if grep -q "issuer is http://localhost:8080/realms/pon" "$STUB/out"; then
  echo "  ok: the issuer failure names the issuer Keycloak announced"
else
  echo "  FAIL: the issuer failure does not name the announced issuer"; fails=$((fails + 1))
fi
expect 1 bad-redirect "fails when Keycloak refuses PON's callback as redirect_uri"
expect 1 registration "fails when the login page offers self-registration"
expect 1 sso-off      "fails when PON reports SSO off"
expect 1 other-idp    "fails when PON sends the browser to another IdP"
expect 1 bad-callback "fails when PON asks to come back to another callback"
expect 0 admin-open   "an openly reachable admin console only warns"

# The admin warning has to say what to do, not just that something is off.
if grep -q "Cloudflare Access" "$STUB/out"; then
  echo "  ok: the admin-console warning points at Cloudflare Access"
else
  echo "  FAIL: the admin-console warning does not mention Cloudflare Access"; fails=$((fails + 1))
fi

# The IdP alone (no PON URL) skips PON's checks instead of failing them.
printf 'sso-off' > "$STUB/mode"
./check.sh "$BASE" >"$STUB/out" 2>&1
[ $? = 0 ] && echo "  ok: without a PON URL only the IdP is checked" \
           || { echo "  FAIL: IdP-only run failed"; sed 's/^/      /' "$STUB/out"; fails=$((fails + 1)); }

# A missing URL is a usage error (2), distinct from a failed check (1).
./check.sh >/dev/null 2>&1
[ $? = 2 ] && echo "  ok: missing URL exits 2, not 1" \
           || { echo "  FAIL: missing URL did not exit 2"; fails=$((fails + 1)); }

# An unreachable host must fail, not pass by reading an empty response as fine.
./check.sh "http://127.0.0.1:1" >/dev/null 2>&1
[ $? = 1 ] && echo "  ok: unreachable host fails" \
           || { echo "  FAIL: unreachable host did not fail"; fails=$((fails + 1)); }

[ "$fails" = 0 ] && { echo "PASS"; exit 0; } || { echo "FAIL ($fails)"; exit 1; }
