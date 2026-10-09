#!/usr/bin/env bash
#
# DEV ONLY — add (or update) a sign-in in the local Keycloak realm `pon`.
#
#   ./scripts/dev/keycloak/add-user.sh <email> [group] [password]
#   ./scripts/dev/keycloak/add-user.sh --remove <email>
#
#     group     IdP group, default `staff`. With the README mapping:
#               staff → Member, admins → Admin. Created if it does not exist.
#     password  default Devpass123!
#
# Idempotent: re-running updates the same user — email verified, enabled,
# password reset, and group membership set to exactly <group> (so moving
# someone from admins to staff really demotes them on the next SSO sign-in).
# Optional KC_FIRST_NAME / KC_LAST_NAME set the name on creation; that name only
# matters for a user PON creates on first SSO sign-in (JIT), an existing PON
# account keeps its own display name.
#
# Use it for a real address you want to demo with, so no personal email ever
# lands in the committed realm-pon.json. Remove it again when you are done.

set -euo pipefail

CONTAINER=pon-keycloak
die() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }
usage() { sed -n '5,10p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }

MODE=add
if [ "${1:-}" = "--remove" ]; then MODE=remove; shift; fi
EMAIL="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
GROUP="${2:-staff}"
PASSWORD="${3:-Devpass123!}"

[[ "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || usage
[[ "$GROUP" =~ ^[A-Za-z0-9._-]+$ ]] || die "group must be a plain name like staff or admins"

docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" \
  || die "Keycloak isn't running — start it with ./scripts/dev/up.sh --sso"

# Everything runs inside the Keycloak container with its own kcadm.sh, so the
# host needs nothing but docker. Values go in as env vars, not argv, and the
# script body is a quoted heredoc, so nothing is re-interpreted on the way in.
docker exec -i \
  -e KC_ADMIN_PASSWORD="${PON_KC_ADMIN_PASSWORD:-admin}" \
  -e U_MODE="$MODE" -e U_EMAIL="$EMAIL" -e U_GROUP="$GROUP" -e U_PASSWORD="$PASSWORD" \
  -e U_FIRST="${KC_FIRST_NAME:-${EMAIL%%@*}}" -e U_LAST="${KC_LAST_NAME:-Demo}" \
  "$CONTAINER" bash -s <<'IN_CONTAINER'
set -euo pipefail
CFG=/tmp/kcadm-pon.config
kc() { /opt/keycloak/bin/kcadm.sh "$@" --config "$CFG"; }

kc config credentials --server http://localhost:8180 --realm master \
  --user admin --password "$KC_ADMIN_PASSWORD" >/dev/null 2>&1 \
  || { echo "  cannot log in to the Keycloak admin API (PON_KC_ADMIN_PASSWORD?)" >&2; exit 1; }

user_id="$(kc get users -r pon -q email="$U_EMAIL" -q exact=true \
  --fields id --format csv --noquotes | head -1)"

if [ "$U_MODE" = remove ]; then
  if [ -z "$user_id" ]; then
    echo "  - $U_EMAIL is not in realm pon (nothing to do)"
  else
    kc delete "users/$user_id" -r pon
    echo "  ✓ removed $U_EMAIL from realm pon"
  fi
  rm -f "$CFG"
  exit 0
fi

if [ -z "$user_id" ]; then
  user_id="$(kc create users -r pon -i \
    -s username="$U_EMAIL" -s email="$U_EMAIL" -s emailVerified=true -s enabled=true \
    -s firstName="$U_FIRST" -s lastName="$U_LAST")"
  echo "  ✓ created $U_EMAIL"
else
  kc update "users/$user_id" -r pon -s emailVerified=true -s enabled=true -s 'requiredActions=[]'
  echo "  ✓ updated $U_EMAIL"
fi

kc set-password -r pon --userid "$user_id" --new-password "$U_PASSWORD"

group_id="$(kc get groups -r pon --fields id,name --format csv --noquotes \
  | grep -E ",${U_GROUP}\$" | cut -d, -f1 | head -1 || true)"
if [ -z "$group_id" ]; then
  group_id="$(kc create groups -r pon -i -s name="$U_GROUP")"
  echo "  ✓ created group $U_GROUP (map it in Admin → SSO, or it grants no role)"
fi

# Exactly one group: drop every other membership first.
kc get "users/$user_id/groups" -r pon --fields id --format csv --noquotes \
  | while read -r gid; do
      if [ -n "$gid" ] && [ "$gid" != "$group_id" ]; then
        kc delete "users/$user_id/groups/$gid" -r pon
      fi
    done
kc update "users/$user_id/groups/$group_id" -r pon \
  -s realm=pon -s userId="$user_id" -s groupId="$group_id" -n

echo "  ✓ $U_EMAIL: email verified, group $U_GROUP, password set"
rm -f "$CFG"
IN_CONTAINER

if [ "$MODE" = add ]; then
  shown='(the one you passed)'
  [ "$PASSWORD" = 'Devpass123!' ] && shown='Devpass123!'
  cat <<EOF

  Sign in with "Sign in with SSO" on http://localhost:3000/login as
    $EMAIL / $shown
  PON only lets it through if Admin → SSO lists its domain (${EMAIL#*@}) under
  allowed domains, and group "$GROUP" needs a role mapping there.
  Remove it afterwards:  ./scripts/dev/keycloak/add-user.sh --remove $EMAIL
EOF
fi
