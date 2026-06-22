# P8 — Enterprise SSO (OIDC) — Completion Report

**Date:** 2026-06-22
**Branch:** `fix/chat-service-cloudrun-startup`
**Spec:** `docs/superpowers/specs/2026-06-22-p8-sso-oidc-design.md`
**Plan:** `docs/superpowers/plans/2026-06-22-p8-sso-oidc.md`
**Status:** ✅ COMPLETE (framework). Live E2E HARD-STOP on owner IdP creds.

---

## Goal

Config-driven enterprise SSO so a self-hosted company's members log in with the company IdP, are
just-in-time provisioned, and have their IdP groups mapped to PON roles/departments — while password
login keeps working.

## Scope (locked with owner in brainstorming)

- **OIDC only** (SAML deferred to a future sibling strategy).
- **Hybrid config**: provider creds in `.env` (P7 secret model); enable flag + group→role/dept
  mappings + allowed domains on the admin-editable Workspace singleton.
- **SSO + password coexist**, JIT provisioning linked by **verified email**.
- **Web + Mobile** both get the SSO login button (cross-platform sync rule).

## Delivered (9 tasks, all committed)

| # | Task | Tests |
|---|------|-------|
| 1 | `Workspace.sso` schema (`WorkspaceSso`) + admin `UpdateWorkspaceDto.sso` passthrough | db +2 |
| 2 | `resolveSsoMapping()` pure fn — group→role precedence + dept union | 6 |
| 3 | `OidcService` (`openid-client@5.7.1`: discovery, PKCE, state/nonce in Redis, ID-token/JWKS/`email_verified` validation) | 5 |
| 4 | `SsoMappingService` (Owner break-glass, dept-id filtering, session revoke on change) + `AuthService.handleOidcLogin` (refactored shared `redirectWithLoginCode`) + controller routes `/auth/oidc/login`,`/callback`,`/auth/sso/info` + module wiring + `UsersService.setRoleAndDepartments` | 3 (+2 existing specs patched) |
| 5 | `.env.example` + `compose.prod.yml` (auth-service `OIDC_*` + `DOMAIN`) + runbook §7 | compose OK |
| 6 | web `getSsoInfo` + login "Sign in with SSO" button (`/api/auth` fallback) + `login.ssoButton` ×7 | web sso-info 1 |
| 7 | web admin `/admin/sso` panel (enable, allowed domains, group→role/dept map editors, default role) + nav + `admin.sso*` ×7 | web build, `/admin/sso` route |
| 8 | mobile `SsoInfo` + repo `getSsoInfo` + login SSO button (`AppConfig.authBaseUrl`→browser→deep-link) + `loginWithSso` ×7 | analyze clean |
| 9 | mobile admin SSO panel (`WorkspaceSso` model, panel widget, tab) + `adminSso*` ×7 | analyze clean |

## Architecture highlights

- **Reuses the existing social-login plumbing**: `/auth/oidc/callback` resolves the user via
  `ensureUserIdFromSocial(profile,'oidc')`, applies the group mapping, then mints the same one-time
  **login code** and returns via the existing web-redirect / mobile-deep-link bridge. The
  `/oauth-callback` (web) and `platform://auth?code=…` (mobile) handlers are provider-agnostic and
  unchanged — so token issuance/refresh/sessions are untouched.
- **IdP stays authoritative**: role/dept are recomputed on every SSO login; the bootstrap Owner is
  exempt (break-glass against IdP misconfig). Sessions are revoked when role/dept change so new JWT
  claims take effect.
- **No secrets leak**: client secret/issuer only in `.env`; `/auth/sso/info` exposes just
  `{enabled, loginUrl, buttonLabel}`.

## Verification (all green)

- `@platform/database` **12** tests, auth-service **46** tests (was 32; +14 SSO), web **54** tests.
- `pnpm --filter @platform/web build` OK — `/admin/sso` route present.
- `cd apps/client && flutter analyze` — No issues found.
- Backward compat: `OIDC_ENABLED` unset → `/auth/sso/info` `{enabled:false}`, no button on either
  client, password + Google/Twitter login behave exactly as before. No migration (schema default +
  code guards).

## Decisions / notes

- `openid-client@^5` pinned (v6 switched to an incompatible functional API; v5 is CJS-friendly for Jest).
- Groups claim varies per IdP — made configurable via `OIDC_GROUPS_CLAIM`; runbook documents per-IdP
  caveats (Google Workspace needs a custom claim; Azure emits object-ids unless mapped).
- Login screen uses `AppConfig.authBaseUrl` for the SSO browser launch (PON_DOMAIN-aware), more correct
  than the legacy `AUTH_BASE_URL` define still used by the Google button (left as-is, out of scope).

## Blocked / loose ends (HARD STOP — code complete)

Live E2E needs an owner-provided IdP: issuer, client id/secret, and a real group. Steps (handoff §4.6):
register `https://<DOMAIN>/api/auth/oidc/callback`, set `.env`, enable + map a group in `/admin` → SSO,
then SSO-login on web + mobile and confirm JIT provisioning with the mapped role.

## Out of scope (deferred)

SAML; SCIM auto-deprovisioning; multiple simultaneous IdPs; per-user IdP overrides; admin-UI editing of
the client secret.

---

**→ With P8 done, P0–P8 are complete: the PON enterprise platform is fully built and green across
backend, web, and mobile.**
