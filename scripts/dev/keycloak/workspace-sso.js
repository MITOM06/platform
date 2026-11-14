// DEV ONLY — shortcut for the Admin → SSO page, for the local Keycloak realm.
//
//   docker exec -i chat-mongo mongosh platform --quiet \
//     --eval "$(cat scripts/dev/keycloak/workspace-sso.js)"
//
//   # extra allowed domains (comma-separated), e.g. for a local demo account:
//   docker exec -i -e SSO_DOMAINS=pon.local,gmail.com chat-mongo mongosh platform --quiet \
//     --eval "$(cat scripts/dev/keycloak/workspace-sso.js)"
//
// Sets exactly what the README walkthrough sets through the UI: SSO enabled,
// allowed domains (default pon.local; listing a domain also turns on JIT
// provisioning for it), IdP group staff → Member, admins → Admin. Dot-path
// $set, so every other sso.* field (the "Require SSO" `enforced` flag,
// groupDeptMap, defaultRole) is left exactly as it is. Writes straight to
// Mongo, so unlike the UI it leaves no `workspace.update` audit entry.
const domains = (process.env.SSO_DOMAINS || 'pon.local')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const res = db.workspaces.updateOne(
  {},
  {
    $set: {
      'sso.enabled': true,
      'sso.allowedDomains': domains,
      'sso.groupRoleMap': { staff: 'Member', admins: 'Admin' },
    },
  },
);
if (res.matchedCount !== 1) {
  print('no workspace document yet. Start auth-service once (it bootstraps one), then re-run');
  quit(1);
}
printjson(db.workspaces.findOne({}, { _id: 0, name: 1, sso: 1 }));
