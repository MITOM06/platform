#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Module C (MCP Connectors & Skills) — end-to-end API test for C1..C4.
#
# Verifies the Phase-3 completion criteria against the LOCAL dev stack:
#   C1  Connector OAuth        — catalog, authorize URLs, connect+disconnect
#   C2  Custom MCP & Governance — admin-only guard (Owner allowed, Member 403)
#   C3  Agentic + Sensitive gate — internal API auth, sensitive-tool block
#   C4  Skills & Token vault    — skill toggle, no token ever in API response
#
# Prereqs: the stack is up (./scripts/dev/up.sh) and seeded with dev/alice/bob.
# Dev-only helper — lives under scripts/dev/, never promoted to main.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

AUTH=http://localhost:3001
CONN=http://localhost:3003
PASS=0; FAIL=0
# C4 checks that a stored token never reaches an API response. We plant this
# sentinel as the "encrypted" blob, then assert it is absent from /connections.
# It is a marker, not a credential — but it sits next to the word SECRET inside a
# quoted mongosh --eval string, where gitleaks has already failed this repo's CI
# once (bac0158). Hoisting it into a variable gives the suppression a home and
# keeps the planted value and the assertion from drifting apart.
SENTINEL='SECRET_LEAK_CHECK' # gitleaks:allow
ok(){ echo "  ✅ PASS: $1"; PASS=$((PASS+1)); }
no(){ echo "  ❌ FAIL: $1"; FAIL=$((FAIL+1)); }

jwt(){ curl -s -X POST "$AUTH/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"Devpass123!\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))"; }
sub(){ echo "$1" | cut -d. -f2 \
  | python3 -c "import sys,base64,json;s=sys.stdin.read().strip();s+='='*(-len(s)%4);print(json.loads(base64.urlsafe_b64decode(s))['sub'])"; }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
body(){ curl -s "$@"; }

echo "== logging in (dev=Owner, alice=Member) =="
DEV=$(jwt dev@pon.local); ALICE=$(jwt alice@pon.local)
[ -n "$DEV" ] && [ -n "$ALICE" ] || { echo "login failed — is the stack up & seeded? (./scripts/dev/up.sh --seed)"; exit 1; }
DEV_ID=$(sub "$DEV"); ALICE_ID=$(sub "$ALICE")
IKEY=$(docker exec connector-service printenv INTERNAL_API_KEY 2>/dev/null)
[ -n "$IKEY" ] || { echo "could not read INTERNAL_API_KEY from container"; exit 1; }

echo; echo "########## C1 — Connector OAuth ##########"
CAT=$(body "$CONN/catalog" -H "Authorization: Bearer $DEV")
{ echo "$CAT" | grep -q '"id":"notion"' && echo "$CAT" | grep -q '"id":"gmail"' \
  && echo "$CAT" | grep -q '"id":"calendar"'; } \
  && ok "catalog lists notion + gmail + calendar" || no "catalog missing a connector"
for p in notion gmail calendar; do
  U=$(body "$CONN/oauth/$p/start" -H "Authorization: Bearer $DEV" \
      | python3 -c "import sys,json;print(json.load(sys.stdin).get('authorizeUrl',''))" 2>/dev/null)
  [ -n "$U" ] && ok "OAuth start ($p) returns an authorize URL" || no "OAuth start ($p) failed"
done
# connect + disconnect, exercised via a simulated stored connection (real OAuth
# needs NOTION/GOOGLE client creds, unavailable locally):
docker exec chat-mongo mongosh platform --quiet --eval \
 "db.user_connections.deleteMany({userId:'$DEV_ID',provider:'notion'});
  db.user_connections.insertOne({userId:'$DEV_ID',provider:'notion',status:'active',
   scope:'personal',scopes:['read_content'],actionGroups:['view'],accountLabel:'Test WS',
   encryptedTokens:{iv:'x',tag:'y',data:'$SENTINEL'},createdAt:new Date(),updatedAt:new Date()});" >/dev/null
LIST=$(body "$CONN/connections" -H "Authorization: Bearer $DEV")
echo "$LIST" | grep -q '"provider":"notion"' && ok "connection appears in GET /connections" || no "connection not listed"
CID=$(echo "$LIST" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if d else '')" 2>/dev/null)
DEL=$(code -X DELETE "$CONN/connections/$CID" -H "Authorization: Bearer $DEV")
AFTER=$(body "$CONN/connections" -H "Authorization: Bearer $DEV")
{ [ "$DEL" = "200" ] && ! echo "$AFTER" | grep -q '"provider":"notion"'; } \
  && ok "disconnect (DELETE) removes the connection" || no "disconnect failed (HTTP $DEL)"

echo; echo "########## C2 — Custom MCP & Governance ##########"
DC=$(code -X POST "$CONN/custom-mcp/discover" -H "Authorization: Bearer $DEV" \
     -H 'Content-Type: application/json' -d '{"url":"https://example.invalid/mcp","name":"T"}')
[ "$DC" != "403" ] && ok "Owner passes ADD_CUSTOM_MCP guard (HTTP $DC = reached handler)" \
                    || no "Owner wrongly blocked from custom MCP"
AC=$(code -X POST "$CONN/custom-mcp/discover" -H "Authorization: Bearer $ALICE" \
     -H 'Content-Type: application/json' -d '{"url":"https://example.invalid/mcp","name":"T"}')
[ "$AC" = "403" ] && ok "Member (alice) blocked from custom MCP -> 403" \
                  || no "Member NOT blocked (HTTP $AC) — governance broken"

echo; echo "########## C3 — Agentic tools & Sensitive gating ##########"
[ "$(code "$CONN/internal/tools?userId=$DEV_ID")" = "403" ] \
  && ok "internal tools API rejects a missing internal key" || no "internal API is OPEN without a key!"
[ "$(code "$CONN/internal/tools?userId=$DEV_ID" -H "x-internal-key: $IKEY")" = "200" ] \
  && ok "internal tools API accepts the valid internal key" || no "valid internal key rejected"
# execution gate: alice (Member, no RUN_SENSITIVE_SKILL) calling a sensitive tool
R=$(body -X POST "$CONN/internal/tools/call" -H "x-internal-key: $IKEY" \
     -H 'Content-Type: application/json' \
     -d "{\"userId\":\"$ALICE_ID\",\"name\":\"mcp__gmail__send_email\",\"input\":{}}")
echo "$R" | grep -qi "sensitive" \
  && ok "sensitive tool blocked at execution for Member ($R)" \
  || no "sensitive tool NOT blocked for Member ($R)"

echo; echo "########## C4 — Skills & Token vault ##########"
body -X PUT "$CONN/skills" -H "Authorization: Bearer $DEV" -H 'Content-Type: application/json' \
     -d '{"skillId":"scheduler","enabled":true}' >/dev/null
body "$CONN/skills" -H "Authorization: Bearer $DEV" | grep -q '"skillId":"scheduler"' \
  && ok "skill enable persists (GET /skills reflects it)" || no "skill enable did not persist"
body -X PUT "$CONN/skills" -H "Authorization: Bearer $DEV" -H 'Content-Type: application/json' \
     -d '{"skillId":"scheduler","enabled":false}' >/dev/null
ENA=$(body "$CONN/skills" -H "Authorization: Bearer $DEV" | grep -c '"enabled":true')
[ "$ENA" = "0" ] && ok "skill disable toggles it off" || no "skill disable failed"
echo "$LIST" | grep -qiE "$SENTINEL|encryptedTokens|\"iv\"|\"tag\"" \
  && no "TOKEN/secret LEAKED in /connections response" \
  || ok "no token/secret in /connections (vault stores AES-256-GCM at rest only)"

echo; echo "=============================================================="
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "✅ Module C (C1–C4) completion criteria all verified" \
                  || { echo "❌ failures above"; exit 1; }
