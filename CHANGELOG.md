# Changelog

All notable changes to PON. One version per promotion to `main`; web, mobile and the
NestJS services share the product version (`apps/client/pubspec.yaml`, `apps/*/package.json`).

## 1.4.0 — 2026-10-10

One feature branch, `feat/new-login-on-main`: Hoàng Dũng's sign-in work (PR #168), rebased onto
1.3.0 and tested on `dev`.

### Upgrade note — the Manager preset role is gone

- **On first boot, everyone holding the preset "Manager" role becomes a Member.** Their sessions
  are revoked (they sign in again) and each move is audited. Members do not see internal AI
  context, so give former managers Admin or a custom role if they need it. A custom role you
  named "Manager" is left alone, and the name can be used again for a new custom role.

### Require SSO

- **Admin → SSO has a "Require SSO for these domains" switch.** When it is on, people whose email
  is in the allowed domains can only sign in through the company identity provider: password
  sign-in, Google, forgot / reset / change password, invitation accept and refreshing a
  non-SSO session all answer "sign in with SSO". The check runs before any password is compared,
  so nothing about the password leaks. Owners are exempt so one can always get in.
- Turning it on signs out every session that was not opened through SSO (sessions now record how
  they were opened). Passwords are disabled, never deleted, so turning it off restores them.
- The switch refuses to turn on while SSO is off, no domain is listed or OIDC is not configured,
  and the confirm dialog lists what will happen.
- The sign-in screen explains the "SSO required" and "SSO unavailable" cases and highlights the
  SSO button; a forced sign-out says it was because of SSO. Web and mobile.

### Two-factor sign-in

- **Members can turn 2FA on or off themselves** in Settings → Security (QR code, code, backup
  codes; turning off takes a current or backup code). Once on, they are asked for a code at every
  sign-in. Owners and Admins still must use 2FA and see it as required.
- Accepting an invitation: Members sign straight in; Owners and Admins set up 2FA first.
- Resetting someone's 2FA follows their role: Admins can reset Members, Owners anyone, nobody
  themselves. Web and mobile.

### SSO fixes

- A group mapping never grants or removes Owner.
- A role or department change from SSO only marks sign-in claims as stale when something really
  changed, instead of signing the person out.
- A failed OIDC discovery is no longer cached and shows "SSO unavailable" instead of a generic
  error.

### Web

- Admin → Roles no longer loops while roles load, and the AI-context capabilities have labels.

## 1.3.0 — 2026-10-10

Batches five branches that were tested together on `dev`: `feat/flutter-flavors-firebase-split`,
`fix/call-answered-elsewhere-mesh`, `fix/ai-sources-persisted`, `fix/observability-e2` and
`fix/ai-eval-judge`.

### Development and production kept apart

- **Mobile flavors `dev` and `prod`, each with its own Firebase project.** Development builds
  (the default) install as "PON Dev" next to the real app (`com.platform.platform_client.dev` /
  `com.tranphuckhang.platformClient.dev`) and never register push tokens or phone sign-ins in
  production. Production keeps its app ids and the `pon-c30fd` project; `main` carries only a stub
  for the development project, so a build without its own project runs without Firebase rather
  than borrowing production's. Details: `docs/environments.md` § Mobile flavors.
- Phone verification says it cannot send a code instead of hanging when a build has no Firebase.

### Calls

- **Answering on one device stops the others ringing** (peer-to-peer calls): a callee signed in
  on web and phone no longer keeps ringing on the second device until the caller gives up.
  LiveKit calls already did this.

### AI

- **An AI reply keeps its citations after a reload.** RAG and web-search sources are stored with
  the message (`sources`) instead of living only in the stream event, so the source chips no
  longer turn back into a bare "[Source 1]". Replies saved before this release have none.
- **AI Eval Gate:** the judge's verdict is read through code fences, stray text, unescaped quotes
  and truncation, a reply with no verdict is retried and then counted as an error (not a failed
  answer), and three rubrics that flipped between runs say what they mean. Same bar, steadier
  gate.

### Observability and security

- **auth-service and connector-service send OpenTelemetry traces** like chat-service and
  ai-service, so one request can be followed across all four services in Jaeger (local stack).
- No more OTLP metrics/logs exports (and their 404 every minute) from the NestJS services:
  traces only, unless `OTEL_METRICS_EXPORTER` / `OTEL_LOGS_EXPORTER` are set.
- connector-service sets the same security headers as the other services (helmet; the OAuth
  popup keeps working) and reports errors to Sentry when `SENTRY_DSN` is set.

### Deploy notes

- **Build the published mobile app with `--flavor prod`** (e.g.
  `flutter build apk --flavor prod --dart-define=PON_DOMAIN=<host>`). A build without `--flavor`
  is a development build. Mobile is now `1.3.0+4`.
- The Mac mini and self-host compose files set `OTEL_ENABLED=false` for auth-service and
  connector-service as they already did for ai-service: nothing to configure there.
- Optional: `SENTRY_DSN` for connector-service.
- No database migration.

## 1.2.0 — 2026-10-08

Batches four feature branches that were tested together on `dev`: `feat/meetings-p1`,
`fix/call-glare`, `feat/call-network-media` and `feat/openrouter-light-tier`.

### Meetings (new, web + mobile)

- **Meetings** (Meet/Teams-style), separate from calls: meet now in one tap, or schedule / edit /
  run again with title, description, date, time and duration in the device time zone, invitees,
  a department and five settings. Upcoming / past lists, a detail page with attendance, shared
  and private notes (auto-saved, conflicts kept), and the meeting chat history. Join by code or
  `/meet/{code}` link, kept across sign-in.
- **Meeting room on LiveKit:** pre-join screen (camera preview, mic / camera, front / back
  camera, speaker / earpiece), waiting room with admit / deny, grid / speaker / pin layouts,
  screen share (present from web and Android; iOS can watch), raised hands in order,
  in-meeting chat, notes, reactions, 13 host actions (mute, remove, lock, end for everyone, …),
  reconnect after a dropped connection.
- Invitations, "starting in 10 minutes" reminders and cancellations as in-app banners, OS
  notifications and push (FCM), translated on the device.
- New capability `HOST_MEETING`, on for every preset role; stored custom roles are not
  backfilled (grant it in Roles). `GET /api/users/me/departments` for the department picker.

### Calls (1-on-1)

- **Both calling each other at once** joins them in one call instead of two "busy" rings, on
  both media paths (server-side claim on LiveKit, the polite peer answers on peer-to-peer).
- **Whose network is weak:** the call screen says whether it is your connection, the other
  person's, or both.
- **A dropped call waits a minute** with a "reconnecting" / "waiting for <name>" screen and a
  countdown, retrying meanwhile, then returns to the chat. Blips under 2.5 s show nothing.
- **Switch between voice and video** mid-call, Messenger-style: the call shows video while
  either camera is on; on mobile the loudspeaker follows (on for video, earpiece for voice).
- A callee whose camera cannot reach an older caller app is told so and the camera goes back off.
- `/app/call.state` is relayed only between two members of the conversation it names.

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

- **Meetings need LiveKit:** set `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` for
  chat-service (runbook `docs/superpowers/runbooks/livekit.md`). Without them meetings can still
  be scheduled, but joining answers 503 and the apps say meetings are unavailable. 1-on-1 calls
  keep `CALL_TRANSPORT` (mesh on the mini) and work either way.
- Optional: add `OPENROUTER_API_KEY` (and `OPENROUTER_MODEL` to pick another model) to the mini
  `.env.mini`, then `./scripts/mini/up.sh --no-pull`.
- Mobile 1.2.0+3 adds the Android screen-share foreground service (`mediaProjection`) and its
  permissions; ship a new build to testers.

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
