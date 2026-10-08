# Changelog

All notable changes to PON. One version per promotion to `main`; web, mobile and the
NestJS services share the product version (`apps/client/pubspec.yaml`, `apps/*/package.json`).

## 1.2.0 — 2026-10-07

### AI cost

- **Light tier through OpenRouter.** With `OPENROUTER_API_KEY` set, short text-only chat turns
  (the router's fast tier) and small background calls — conversation titles, history compaction,
  memory facts, daily digests — run on `OPENROUTER_MODEL` (default `google/gemini-2.5-flash-lite`,
  about 10x cheaper than Claude Haiku). Longer or harder turns, answers grounded in the knowledge
  base, images, KB vision and call summaries stay on Claude. Any OpenRouter failure falls back to
  Claude automatically. Without the key nothing changes.
- **Demo cost profile on the Mac mini (0 USD light tier):** the fast and mid tiers run on the free
  `nvidia/nemotron-3-super-120b-a12b:free` (OpenRouter; 50 requests/day until 10 USD of credits were
  ever bought, then 1000/day) and the complex tier on Claude Sonnet 4.5 instead of Opus. When
  OpenRouter answers 429 / 402 / 404 the light tier moves to Claude Haiku for 10 minutes
  (`OPENROUTER_COOLDOWN_MS`). Free models cost 0 on the usage dashboard. Free-model providers may
  log prompts — demo data only.

### Operations

- The Cloud Run deploy workflow runs only when started by hand (production is on the Mac mini).

### Deploy notes

- Optional: add `OPENROUTER_API_KEY` (and `OPENROUTER_MODEL` to pick another model) to the mini
  `.env.mini`, then `./scripts/mini/up.sh --no-pull`.

## 1.1.0 — 2026-10-06

First versioned release. Batches four feature branches that were tested together on `dev`:
`fix/qc-sweep-2026-10-05`, `feat/new-login-2fa`, `feat/calls-livekit` (includes
`fix/call-stuck-ringing` and `fix/call-1on1-reliability`) and
`fix/ai-tools-user-lookup-rag-threshold`, plus `chore/google-only-oauth`.

### Security & sign-in

- **Mandatory two-factor authentication (TOTP)** for Owner, Admin and any role that grants
  `MANAGE_WORKSPACE`, `MANAGE_MEMBERS` or `MANAGE_ROLES`, on password and Google sign-in (OIDC SSO is
  exempt — the identity provider owns MFA). Enrollment with QR code, 10 single-use backup codes that
  must be acknowledged before the first session, verify with a code or a backup code, regenerate codes
  in Settings, Owner-only reset of a member's 2FA. Secrets AES-256-GCM encrypted, backup codes hashed,
  per-token and per-user attempt limits. Web + mobile.
- **Google-invite password step:** an account created by accepting an invitation with Google must
  create a PON password before using the app; welcome email after accepting an invitation (7 locales).
- **Role / department changes apply without signing out:** sessions are marked claims-stale, the
  next request refreshes silently (`401 TOKEN_CLAIMS_STALE`, `CLAIMS_CHANGED` push).
- Logout ends only the caller's own session (a body `sid` could end someone else's).
- Changing the password signs out every *other* session; 8-character minimum; typed error codes.
- Emails are trimmed + lower-cased for login, OTP and lockout counters.
- Forgot-password: verify-OTP no longer burns the code before the reset.
- Google / OIDC sign-in into an existing account requires an IdP-verified email.
- **Social login is Google only:** the last X/Twitter and Facebook leftovers are gone (deploy secrets,
  Mac mini env variables, the X redirect URI in `scripts/mini/up.sh`, README routes).
- Rate limiting keys on the real client IP behind Cloudflare / the reverse proxy.
- Roles: non-Owners cannot grant capabilities they don't hold, edit their own role or map SSO groups
  to Owner; preset roles keep their names; duplicate role names answer `ROLE_NAME_TAKEN` (was a 500).
- Friends lists return the public profile shape (no FCM tokens / devices / hidden fields).
- Dead FCM tokens are pruned; blocking a member clears their push tokens.

### Calls

- **1-on-1 and group calls through LiveKit (SFU)** on web and mobile, alongside peer-to-peer
  (`CALL_TRANSPORT=mesh|sfu`, default `mesh`). Token, webhook and room-control endpoints; LiveKit
  config refused in production when half set.
- 1-on-1 call reliability: no more endless ringing, ringtone / ringback, busy and declined replies,
  end reasons shown to the other side, early ICE kept, survives short disconnects, background
  notification for incoming calls.

### Chat & realtime

- Realtime survives reconnects on web and mobile: subscriptions are re-established on every
  reconnect and the conversation list catches up.
- Pinned messages limited to 5; group admins can be promoted / demoted; public channels
  (discoverable and joinable from Explore).
- Conversation state (pin, mute, archive, nickname) is private to each member.
- AI replies stream per reply (concurrent questions no longer mix), the reply id is persisted.

### AI & integrations

- **Confirmation card for sensitive AI actions:** connector actions that write or delete wait for
  the user's confirmation in the chat (confirm / cancel, 10-minute expiry).
- AI tools resolve users by their real ids; the RAG relevance threshold no longer drops real answers.
- Honest AI quota card, readable connector scopes, "Hosted MCP" label, connector management on
  mobile; personal assistant setup is prefilled and its errors are localized.
- Admin: localized audit log (names instead of ids, "System"), usage by calendar month, AI-context
  capability labels, member / department editors fixed.

### Infrastructure

- chat-service reaches connector-service internally (`CONNECTOR_SERVICE_BASE_URL`,
  `CONNECTOR_INTERNAL_KEY`); the connector's `/internal` routes are not exposed publicly.
- connector-service advertises its public MCP URL (`MCP_SERVER_URL`).
- Self-host Caddy routes the web session cookie endpoints to Next.js.
- LiveKit host definitions for the self-host stack and the Mac mini.

### Deploy notes

- Mac mini (`compose.mini.yml`): `SESSION_SECRET`, `INTERNAL_API_KEY` and `PON_API_BASE` must be
  set (all three were already required before 1.1.0).
- `SESSION_SECRET` now also encrypts 2FA secrets: **rotating it invalidates every 2FA enrollment**
  (an Owner must reset the affected members).
- Existing privileged users are asked to enroll in 2FA at their next sign-in; existing sessions stay
  valid. Older mobile builds cannot complete the 2FA step — ship the 1.1.0 app before or with the
  backend.
- `FACEBOOK_APP_*`, `X_CLIENT_*` and `X_CALLBACK_URL` are no longer read — remove them from the
  mini `.env` and the GitHub secrets, and drop the `/auth/x/callback` redirect URI from the OAuth
  consoles.
- LiveKit stays off unless `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` are set and
  `CALL_TRANSPORT=sfu`.

### Not verified end-to-end yet

- The AI confirmation card and Module A flows (Anthropic credit was exhausted during testing).
- 2FA after the branch merge (unit-tested only) and LiveKit calls on real devices.
