# P8 — Enterprise SSO (OIDC) — Design

**Date:** 2026-06-22
**Status:** Approved (design) — ready for implementation plan
**Predecessors:** P0 (RBAC + admin + audit), P1/P5 (connectors), P6 (department group bot), P7 (self-host kit) — all DONE.
**Spec vision:** `docs/superpowers/specs/2026-06-19-pon-enterprise-reframe.md` (§ "SSO — later phase, config-driven").

---

## 1. Goal

Add **config-driven enterprise Single Sign-On** so a self-hosted company can let its members log in
with the company IdP (Google Workspace, Microsoft Entra/Azure AD, Okta, Auth0, Keycloak — anything
OpenID-Connect). On first SSO login a user is provisioned just-in-time and their **IdP groups are
mapped to PON roles and departments**, so RBAC stays driven by the company's existing identity system.

**Scope (locked in brainstorming):**
- **OIDC only.** SAML is explicitly deferred (can be added later as a sibling strategy).
- **Hybrid config.** Sensitive provider credentials live in the deployment `.env` (P7 secret model);
  admin-editable bits (enable flag, group→role/dept mappings, allowed email domains) live on the
  Workspace singleton, editable in `/admin`.
- **SSO + password coexist.** Existing email/password login stays. An SSO button appears when SSO is
  configured. First SSO login auto-creates the user (JIT), linked by **verified email**.
- **Web + Mobile both** get the SSO login button (cross-platform sync rule).

**Out of scope:** SAML; SCIM auto-deprovisioning; per-user IdP overrides; multiple simultaneous IdPs
(one IdP per deployment); admin-UI editing of the client secret (it stays in `.env`).

## 2. Starting point (what already exists)

From the auth-service exploration:
- **Social login pattern** already exists for Google/Twitter: `AuthService.handleSocialLogin()`
  (`auth.service.ts:43-103`) + `ensureUserIdFromSocial()` (`105-142`). It find-or-creates a user,
  links the provider in the `socialLinks` map on the User doc, mints a short-lived **login code**
  (Redis, 300s TTL), and redirects — **web redirect** or **mobile deep-link**. The web `/oauth-callback`
  page already exchanges that login code for tokens.
- **JWT** already carries `{ sub, sid, role, perms, depts }`; `ClaimsService.resolve(userId)`
  (`claims.service.ts:38-61`) derives role/perms/depts from the user's `roleId` + `departmentIds`.
  **So once SSO sets the user's roleId/departmentIds, the rest of the token pipeline is unchanged.**
- **Workspace singleton** (`workspace.schema.ts`) holds company config (`name`, `logoUrl`,
  `primaryColor`, `features`, `connectorAllowList`) — the natural home for the SSO mapping config.
  Edited via `PATCH /admin/workspace` (`UpdateWorkspaceDto`).
- **Bootstrap Owner** (`bootstrap.service.ts:80-95`) assigns the Owner role to the
  `BOOTSTRAP_OWNER_EMAIL` user **if it exists and has no role yet** — works for an SSO-provisioned
  Owner too.
- **Refresh/session** uses rotating refresh tokens with reuse detection (`session.service.ts`) — SSO
  reuses this unchanged via the existing login-code path.
- **Deps present:** `@nestjs/jwt`, `@nestjs/passport`, `passport-google-oauth20`. **No OIDC lib** —
  we add `openid-client`.

## 3. Approach

Use **`openid-client`** (the OpenID-certified relying-party library) for discovery, JWKS, PKCE,
state/nonce, and ID-token validation. Wire it into the **existing** `handleSocialLogin` flow rather
than as a Passport strategy (that flow is already a manual redirect→callback→login-code pattern, not
Passport-session-based). Rejected alternatives: `passport-openidconnect` (less maintained, weaker
validation defaults) and hand-rolled OIDC (reinvents security-critical JWKS/nonce/validation code).

## 4. Architecture

### 4.1 Backend OIDC flow (auth-service)

New folder `src/modules/auth/oidc/`:
- **`oidc.service.ts`** — wraps `openid-client`:
  - Lazy issuer **discovery** from `OIDC_ISSUER` (cached); builds the RP `Client` from
    `OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET`/redirect URI.
  - `buildAuthorizeUrl({ client, returnTo })` → generates PKCE `code_verifier`, `state`, `nonce`,
    stores them in Redis (`oidc:flow:<state>`, short TTL) keyed by `state`, returns the IdP authorize URL.
  - `handleCallback({ code, state })` → loads + deletes the Redis flow record (one-time), exchanges
    the code (PKCE), **validates the ID token** (signature via JWKS, `iss`, `aud`, `nonce`, `exp`,
    `email_verified`), returns a normalized profile `{ email, displayName, sub, groups: string[] }`.
- **`sso-mapping.ts`** — pure function `resolveSsoMapping(groups, ssoConfig, roles, departments)
  → { roleId?, departmentIds: string[] }`. Maps IdP group names → a single PON role (highest-priority
  match, else `defaultRole`) and → department ids (union of all matching groups). No DB/IO — unit-testable.
- **Routes** on `AuthController`, mirroring the Google routes:
  - `GET /auth/oidc/login?client=web|mobile&returnTo=…` → 302 to `oidc.service.buildAuthorizeUrl()`.
  - `GET /auth/oidc/callback?code=…&state=…` → `oidc.handleCallback()` →
    enforce `allowedDomains` (if set) on the email → `ensureUserIdFromSocial(profile, 'oidc')`
    (JIT create/link by verified email) → apply `resolveSsoMapping` to set `user.roleId`/`departmentIds`
    (re-applied every login; **never demote the bootstrap Owner**) → revoke existing sessions if role/dept
    changed (existing `revokeAllSessions` semantics) → mint login code → redirect (web) / deep-link (mobile)
    via the existing helper. Audit-log `sso.login` (+ `sso.provision` on JIT create, `sso.role_mapped`
    on role/dept change).

### 4.2 SSO config on the Workspace singleton

Extend `workspace.schema.ts` with an embedded `sso` sub-document (all optional, additive):
```
sso: {
  enabled: boolean (default false),
  allowedDomains: string[] (default []),     // empty = any verified email
  groupRoleMap: Record<string,string>,        // idpGroup → role NAME
  groupDeptMap: Record<string,string>,        // idpGroup → department id
  defaultRole?: string,                        // role NAME for users with no mapped group
}
```
Extend `UpdateWorkspaceDto` + `AdminService.updateWorkspace` to accept `sso` (validated). The client
secret/issuer are **never** stored here. Mutations audit-logged like other workspace changes.

### 4.3 Client discovery endpoint

`GET /auth/sso/info` (public, no auth) →
```
{ enabled: boolean, loginUrl: string|null, buttonLabel: string }
```
`enabled` = `OIDC_ENABLED` env truthy **AND** `workspace.sso.enabled`. `loginUrl` = the relative
`/auth/oidc/login` path (clients prefix their auth base). No secrets exposed. Clients call this to
decide whether to render the SSO button.

### 4.4 Web (Next.js)

- `lib/api/auth.ts`: `getSsoInfo()` + `SsoInfo`/`WorkspaceSso` types.
- Login page (`app/(auth)/login/…`): on mount query `getSsoInfo()`; if enabled, render a
  **"Sign in with SSO"** button that navigates to `${authBase}/auth/oidc/login?client=web`. The
  existing `/oauth-callback` page handles the returned login code unchanged.
- Admin: an **SSO panel** (enable toggle, allowed domains, group→role and group→department map rows,
  default role) under `/admin`, reusing the workspace query/mutation hooks. Cap-gated like other admin
  sections (`MANAGE_WORKSPACE`).
- i18n: SSO button + admin SSO labels in all 7 `messages/*.json`.

### 4.5 Mobile (Flutter)

- `AdminRepository`/auth repo: `getSsoInfo()`.
- Login screen: mirror web — if SSO enabled, show an SSO button that opens the system browser to
  `/auth/oidc/login?client=mobile`; the IdP redirects to the existing **deep-link** which the app
  already handles (social-login code exchange path reused).
- Admin: SSO panel mirrored in the Flutter admin feature (parity with web — same fields/caps).
- i18n: same keys across all 7 `app_*.arb`, then `flutter gen-l10n`.

## 5. Config & deployment (P7 integration)

New `.env` keys (added to `.env.example`, `compose.prod.yml` auth-service env, and the self-host runbook):
```
OIDC_ENABLED=          # "true" to turn the feature on
OIDC_ISSUER=           # e.g. https://accounts.google.com or your Okta/Entra issuer
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_SCOPES=openid email profile groups
OIDC_GROUPS_CLAIM=groups
# Redirect URI derived from P7 DOMAIN: https://${DOMAIN}/api/auth/oidc/callback
```
The runbook documents registering `https://<DOMAIN>/api/auth/oidc/callback` in the IdP console, then
enabling SSO + filling group mappings in `/admin`.

## 6. Security

- **PKCE** (S256), **state** (CSRF), **nonce** (replay) — all stored server-side in Redis, one-time use.
- ID-token **signature** verified via the issuer JWKS (handled by `openid-client`); `iss`/`aud`/`exp`/
  `nonce` validated; **`email_verified`** required; `allowedDomains` enforced on the email.
- Redirect URI is HTTPS via the P7 Caddy proxy; only the configured callback is registered at the IdP.
- Client secret only in `.env` (never DB, never `NEXT_PUBLIC_*`, never logged). `sso/info` exposes no secrets.
- Bootstrap Owner is never demoted by group mapping (break-glass against IdP misconfig).

## 7. Backward compatibility

Fully additive. With `OIDC_ENABLED` unset: `sso/info.enabled=false`, no button on either client,
password login and the existing Google/Twitter social login behave exactly as today. No JWT/session/
refresh changes. Existing documents lack the `sso` field → schema default + code guards handle it; no
migration needed.

## 8. Testing & verification

- **auth-service unit tests:** `resolveSsoMapping()` (group→role/dept matrix, default role, Owner
  protection); `OidcService` authorize-URL building + callback claim extraction (mock `openid-client`);
  `/auth/sso/info` gating (env × workspace flag); `allowedDomains` enforcement.
- **Regression:** `@platform/database`, auth-service, connector-service, ai-service suites stay green.
- **Web:** `pnpm --filter @platform/web test` + `build` (strict TS) green.
- **Mobile:** `flutter analyze` clean (+ `flutter test` if mapping logic is mirrored client-side).
- **Manual E2E (HARD STOP on owner IdP creds):** register callback in a real IdP, set `.env`, enable
  in `/admin`, map a group → Manager, log in via SSO on web + mobile → user provisioned with the mapped
  role; confirm `/admin` access matches.

## 9. Risks / notes

- **Live E2E blocked on an owner-provided IdP** (issuer, client id/secret, a real group). The framework
  is complete regardless — HARD STOP per the P7/handoff pattern.
- **Groups claim varies by IdP** (`groups`, `roles`, Azure needs a manifest/Graph call for group names).
  Made configurable via `OIDC_GROUPS_CLAIM`; documented per-IdP caveats in the runbook.
- **Re-mapping on every login** keeps the IdP authoritative but means admin role edits are overwritten
  for SSO users — intended (IdP is source of truth); the Owner is exempt.
- **openid-client ESM/CJS**: pin a version compatible with the auth-service module setup; verify import
  style during implementation.
