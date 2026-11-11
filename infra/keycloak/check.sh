#!/usr/bin/env bash
#
# Asserts that the production Keycloak and PON's side of SSO agree with each
# other. Takes the URLs as arguments so nothing here names an environment.
#
#   ./infra/keycloak/check.sh https://sso.example.com                          # the IdP only
#   ./infra/keycloak/check.sh https://sso.example.com https://api.example.com  # + PON
#
# Run it after the first start, after editing .env.keycloak or the OIDC_* lines
# of .env.mini, and after a Keycloak upgrade. Exits 1 naming every broken
# check, 2 on a usage error. Warnings (yellow) do not fail the run.

set -uo pipefail

SSO="${1:-}"; SSO="${SSO%/}"
API="${2:-}"; API="${API%/}"
[ -n "$SSO" ] || { echo "usage: check.sh <sso-base-url> [pon-api-base-url]"; exit 2; }

REALM="${PON_SSO_REALM:-pon}"
CLIENT_ID="${PON_SSO_CLIENT_ID:-pon-auth}"
ISSUER="$SSO/realms/$REALM"
CURL=(curl -sS --max-time 20)
failures=0

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }
yel() { printf '\033[33m%s\033[0m\n' "$*"; }
fail() { red "  ✗ $1"; failures=$((failures + 1)); }
pass() { grn "  ✓ $1"; }
warn() { yel "  ! $1"; }

# First "key": "value" pair in a JSON body. The first hit is the top-level one:
# Keycloak's discovery document repeats endpoint names under mtls_endpoint_aliases.
json_str() {
  printf '%s' "$1" | tr -d '\n' | grep -oE "\"$2\" *: *\"[^\"]*\"" | head -1 \
    | sed -E 's/^"[^"]*" *: *"(.*)"$/\1/'
}

# Percent-encodes everything but unreserved characters (bash 3.2 safe).
urlencode() {
  local s="$1" out="" c hex i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) printf -v hex '%%%02X' "'$c"; out+="$hex" ;;
    esac
  done
  printf '%s' "$out"
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

echo "Keycloak: $SSO (realm $REALM)"
case "$SSO" in
  https://*) ;;
  *) warn "the IdP is not on HTTPS — fine on a laptop, never in production" ;;
esac

# --- 1. discovery ------------------------------------------------------------
# PON's OIDC_ISSUER must equal the issuer Keycloak announces, byte for byte:
# openid-client rejects every ID token whose `iss` differs.
disc="$("${CURL[@]}" "$ISSUER/.well-known/openid-configuration" 2>/dev/null)"
issuer="$(json_str "$disc" issuer)"
if [ -z "$issuer" ]; then
  fail "no discovery document at $ISSUER/.well-known/openid-configuration (Keycloak down, realm missing, or the tunnel route points elsewhere)"
elif [ "$issuer" != "$ISSUER" ]; then
  fail "issuer is $issuer, expected $ISSUER — KC_HOSTNAME in .env.keycloak does not match the public hostname"
else
  pass "issuer $issuer"
  auth_ep="$(json_str "$disc" authorization_endpoint)"
  case "$auth_ep" in
    "$ISSUER"/*) pass "endpoints are on the public hostname" ;;
    *) fail "authorization_endpoint is $auth_ep — Keycloak builds links for another host (KC_HOSTNAME / KC_PROXY_HEADERS)" ;;
  esac
fi

# --- 2. the login page -------------------------------------------------------
# Opened the way PON opens it: PON's callback as redirect_uri (Keycloak answers
# "Invalid parameter: redirect_uri" if the client was imported with another
# one) and a PKCE challenge (the client requires S256; without one Keycloak
# bounces the request back instead of showing the page — any valid challenge
# renders it, this is RFC 7636's example). Needs PON's URL for the callback.
if [ -z "$API" ]; then
  warn "login page not checked — pass PON's API URL as the second argument to check it"
  code=skip
else
  login_url="$ISSUER/protocol/openid-connect/auth?client_id=$CLIENT_ID&response_type=code&scope=openid"
  login_url="$login_url&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256"
  login_url="$login_url&redirect_uri=$(urlencode "$API/api/auth/auth/oidc/callback")"
  page="$("${CURL[@]}" -w '\n%{http_code}' "$login_url" 2>/dev/null)"
  code="${page##*$'\n'}"
fi
if [ "$code" = "skip" ]; then
  :
elif [ "$code" != "200" ]; then
  if printf '%s' "$page" | grep -qi 'redirect_uri'; then
    fail "Keycloak refuses PON's callback as redirect_uri — the pon-auth client's Valid redirect URIs must be $API/api/auth/auth/oidc/callback"
  else
    fail "login page for client $CLIENT_ID answered $code (client missing or disabled?)"
  fi
else
  pass "login page for client $CLIENT_ID"
  # Accounts are created by an admin; a public "Register" link would let anyone in.
  if printf '%s' "$page" | grep -q 'registrations?'; then
    fail "the login page offers self-registration — Realm settings → Login → User registration must be off"
  else
    pass "no self-registration link"
  fi
fi

# --- 3. the admin console ----------------------------------------------------
# Not a failure (it is still password-protected), but it should sit behind
# Cloudflare Access: anything other than a plain 200 means something guards it.
admin_code="$("${CURL[@]}" -o /dev/null -w '%{http_code}' "$SSO/admin/master/console/" 2>/dev/null)"
if [ "$admin_code" = "200" ]; then
  warn "the admin console is reachable by anyone ($SSO/admin/) — put Cloudflare Access in front of it (runbook, step 4)"
else
  pass "admin console is not openly reachable ($admin_code)"
fi

# --- 4. PON's side -----------------------------------------------------------
if [ -n "$API" ]; then
  echo "PON: $API"
  info="$("${CURL[@]}" "$API/api/auth/auth/sso/info" 2>/dev/null | tr -d ' \n')"
  case "$info" in
    *'"enabled":true'*) pass "PON shows \"Sign in with SSO\"" ;;
    '') fail "no answer from $API/api/auth/auth/sso/info" ;;
    *) fail "PON reports SSO off — set OIDC_ENABLED/OIDC_ISSUER/OIDC_CLIENT_ID in .env.mini, redeploy, and turn on Admin → SSO → Enable SSO" ;;
  esac

  loc="$("${CURL[@]}" -o /dev/null -w '%{redirect_url}' "$API/api/auth/auth/oidc/login?platform=web" 2>/dev/null)"
  case "$loc" in
    "$ISSUER/protocol/openid-connect/auth"*)
      pass "PON sends the browser to this Keycloak"
      want="redirect_uri=$(lower "$(urlencode "$API/api/auth/auth/oidc/callback")")"
      case "$(lower "$loc")" in
        *"$want"*) pass "PON asks to come back to $API/api/auth/auth/oidc/callback" ;;
        *) fail "PON's redirect_uri is not $API/api/auth/auth/oidc/callback — check OIDC_REDIRECT_URI / PON_API_BASE in .env.mini" ;;
      esac
      ;;
    *SSO_UNAVAILABLE*) fail "PON cannot reach the IdP (SSO_UNAVAILABLE) — OIDC_ISSUER wrong or unreachable from the mini" ;;
    *error=*) fail "PON refused to start SSO: ${loc#*error=}" ;;
    '') fail "PON's /auth/oidc/login did not redirect" ;;
    *) fail "PON redirects to $loc, not to $ISSUER — OIDC_ISSUER in .env.mini points at another IdP" ;;
  esac
fi

if [ "$failures" -gt 0 ]; then
  red "$failures check(s) failed"
  exit 1
fi
grn "SSO checks passed"
