# Local development — onboarding

Everything here is **dev-only** and lives on the `dev` branch. See
`.claude/rules/dev-local-only.md` for why none of it goes to `main`.

## First time on a new machine

**1 — Install the prerequisites**

| Tool | Why |
|---|---|
| Docker Desktop | runs Mongo, Redis, RabbitMQ + all four backend services |
| Node 20+ and `pnpm` 9 | the Next.js web app and the user-seed script |
| Flutter SDK 3.44 | only if you work on the mobile app |
| Xcode | only for iOS builds |

You do **not** need Java or Maven: chat-service is built inside Docker.

**2 — Clone and switch to `dev`**

```bash
git clone https://github.com/MITOM06/platform.git
cd platform
git checkout dev          # dev = main + the local-env commits
pnpm install
```

**3 — Get the secrets.** They are gitignored, so a fresh clone has none. Ask the
repo owner for the values, then:

```bash
cp infra/docker-compose/.env.example     infra/docker-compose/.env
cp apps/server/auth-service/.env.example apps/server/auth-service/.env
cp apps/web/.env.example                 apps/web/.env.local
```

The ones that actually matter for booting: `JWT_ACCESS_SECRET` (must be
**identical** everywhere), `ANTHROPIC_API_KEY` (AI replies), `INTERNAL_API_KEY`,
`CONNECTOR_VAULT_KEY`, `MAIL_*`. `up.sh` refuses to start if the first two files
are missing and tells you which template to copy.

You do not create `apps/web/.env.development.local` — `up.sh` generates it, since
it only holds localhost URLs.

**4 — Start everything**

```bash
./scripts/dev/up.sh --seed
```

Then log in at http://localhost:3000 with `dev@pon.local` / `Devpass123!`.
For the mobile app: `./scripts/dev/up.sh --phone` (real device, lightest) or
`--flutter` (iOS simulator).

## Every day after that

```bash
git checkout dev
git fetch origin && git merge origin/main   # latest code, env commits untouched
./scripts/dev/up.sh                         # no --seed: your test data is kept
```

Your test data lives in the Docker volume `docker-compose_mongo_data`, not in
git, so it survives branch switches. Re-run with `--seed` only when you want it
reset. Add `--build` after backend code changes, so the images are rebuilt.

## Working on a feature

Debug and test every change on `dev` first; it reaches `main` only after it
passed here.

```bash
git fetch origin
git checkout -b feat/x origin/main      # feature commits only
# ...code, unit tests...
git push -u origin feat/x

git checkout dev && git merge --no-ff feat/x
./scripts/dev/up.sh --build             # run the feature on the full stack
git push origin dev                     # teammates test it too
```

Fix bugs on `feat/x`, merge it into `dev` again, repeat. Once it passes, open
the PR from `feat/x` (never from `dev`) into `main`:

```bash
git diff origin/main...feat/x --stat    # must list ONLY your feature's files
```

If that diff shows `scripts/dev/`, a seed script or a `*.local` env file, stop —
see `.claude/rules/dev-local-only.md`.

## SSO with a local Keycloak

`./scripts/dev/up.sh --sso` adds a Keycloak dev IdP (`quay.io/keycloak/keycloak:26.7.5`,
`start-dev`) to the stack and recreates `auth-service` with the OIDC env
(`scripts/dev/keycloak/compose.sso.yml`, layered on the normal compose file).
Combine it with the other flags, e.g. `./scripts/dev/up.sh --sso --seed`.

| | |
|---|---|
| Issuer | `http://keycloak.localhost:8180/realms/pon` |
| Admin console | http://keycloak.localhost:8180/admin, `admin` / `admin` (loopback only) |
| Client | `pon-auth`: confidential, secret `pon-dev-only`, standard flow + PKCE S256, redirect `http://localhost:3001/auth/oidc/callback` |
| `groups` claim | group names without path (`staff`, not `/staff`), in the ID token |
| auth-service env | `OIDC_ENABLED=true`, `OIDC_ISSUER`, `OIDC_CLIENT_ID=pon-auth`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, `OIDC_GROUPS_CLAIM=groups` |

IdP users, all with a verified email and the seed password `Devpass123!`:

| IdP user | Group | In PON |
|---|---|---|
| `alice@pon.local` | `staff` | seeded account → SSO links it, role Member |
| `bob@pon.local` | `admins` | seeded account → SSO links it, role Admin |
| `carol@pon.local` | `staff` | not in PON → created on first SSO sign-in (JIT), role Member |

**Why `keycloak.localhost`.** The browser (sent to the login page) and the
auth-service container (discovery + token exchange) must use the *same* issuer
URL, or the ID token's `iss` does not match. Chrome, Edge, Firefox and curl
resolve every `*.localhost` name to loopback on their own, and inside the
container `extra_hosts` points it at the host, so it works with no hosts-file
edit and Keycloak stays on 127.0.0.1. `host.docker.internal` resolves on the host
only if Docker Desktop's optional hosts-file entry is on (it maps to the LAN IP,
so Keycloak would have to listen on the LAN); opt in with
`PON_SSO_HOST=host.docker.internal ./scripts/dev/up.sh --sso` — `up.sh` refuses a
name this machine cannot resolve. Safari does not resolve `*.localhost`: use
Chrome, Edge or Firefox.

### Demo walkthrough

1. **Start.** `./scripts/dev/up.sh --sso --seed`. The `Checking SSO` step must show
   the issuer answering both on this machine and inside auth-service.
2. **Configure SSO as the Owner.** Sign in at http://localhost:3000 as
   `dev@pon.local` / `Devpass123!` (+ the 2FA code), open **Admin → SSO**, then:
   - **Enable SSO**: on
   - **Allowed email domains**: `pon.local` (listing a domain is also what allows
     first-time SSO users from it to be created)
   - **Group → Role**: **Add mapping** twice: `staff` → `Member`, `admins` → `Admin`
   - **Save**

   Shortcut that sets the same three values straight in Mongo (no audit entry,
   leaves every other SSO field alone):
   ```bash
   docker exec -i chat-mongo mongosh platform --quiet \
     --eval "$(cat scripts/dev/keycloak/workspace-sso.js)"
   ```
3. **New person, JIT.** Sign out. `/login` now shows **Sign in with SSO**. Click
   it: you land on the Keycloak page "Sign in to PON dev IdP". Sign in as
   `carol@pon.local` / `Devpass123!` → you come back to
   `http://localhost:3000/oauth-callback?code=…` and are signed in as *Carol
   Test*, role **Member**, with no PON 2FA step (the IdP owns MFA for SSO).
4. **Existing accounts.** Sign out, SSO again as `bob@pon.local` → the seeded
   Bob is linked and becomes **Admin**; `alice@pon.local` → **Member**.
5. **Require SSO** (needs an auth-service image with the enforcement work —
   `./scripts/dev/up.sh --sso --build` if the toggle is missing or refuses to
   save). As the Owner: Admin → SSO → **Require SSO for these domains** →
   confirm → **Save**. Now password sign-in as `alice@pon.local` is
   refused with "Your organization requires single sign-on"; anyone in
   `pon.local` signed in without SSO is signed out; the Owner `dev@pon.local`
   still signs in with password + 2FA (break-glass). Turn it off and Save to
   restore password sign-in (passwords are disabled, never deleted).

### Demo with your own account

Never put a real address in `realm-pon.json` (it is committed). Add yourself to
the running Keycloak instead, then remove yourself afterwards:

```bash
./scripts/dev/keycloak/add-user.sh you@gmail.com admins      # [group, default staff] [password, default Devpass123!]
./scripts/dev/keycloak/add-user.sh --remove you@gmail.com    # when done
```

It is idempotent: re-running resets the password, re-verifies the email and sets
the membership to exactly that group. Then add your domain to **Allowed email
domains** (e.g. `pon.local, gmail.com`), or
`docker exec -i -e SSO_DOMAINS=pon.local,gmail.com chat-mongo mongosh platform --quiet --eval "$(cat scripts/dev/keycloak/workspace-sso.js)"`.

Before you sign in with SSO, know that:

- **A public domain like `gmail.com` is for a local demo only, never for a real
  company.** An allowed domain means "anyone the IdP vouches for at this domain
  may get an account (created on first sign-in)", and with Require SSO on it
  pushes *every* member at that domain onto SSO. Take it out again after the demo.
- **Each SSO sign-in re-applies Group → Role**, and an account whose groups map to
  nothing loses its role. Pick the group that matches the account's current role.
  **An Owner is demoted too** (only `BOOTSTRAP_OWNER_EMAIL` is exempt): to demo
  with an Owner account, add a mapping `owners` → `Owner` and use
  `add-user.sh you@gmail.com owners`.
- **Each SSO sign-in signs that account out everywhere else** (auth-service
  revokes the user's other sessions whenever it applies the mapping).

### Resetting

- Remove a JIT-created user, e.g. carol:
  `docker exec chat-mongo mongosh platform --quiet --eval 'db.users.deleteOne({email: "carol@pon.local"})'`
- Keycloak keeps its data inside the container: users added with `add-user.sh`
  survive restarts but not a recreate. After editing `realm-pon.json`, re-import:
  `docker compose -f infra/docker-compose/compose.yml -f scripts/dev/keycloak/compose.sso.yml up -d --force-recreate keycloak`
  (with the dev secrets exported, see the top of `compose.sso.yml`).
- SSO off again: `./scripts/dev/up.sh` without `--sso` recreates auth-service
  without the OIDC env; `docker rm -f pon-keycloak` removes the IdP. The
  workspace SSO settings stay in Mongo until you change them in Admin → SSO.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `missing infra/docker-compose/.env` | step 3 above |
| chat-service never comes up | usually `ALLOWED_ORIGINS` or Mongo: `docker logs chat-service` |
| ai-service restarts forever, 406 `PRECONDITION_FAILED` | a stale `ai.requests` queue; `up.sh` fixes this automatically on start |
| Web shows prod data | `apps/web/.env.development.local` is missing or the dev server was started before it existed — restart `pnpm web` |
| Phone can't reach the backend | it must be on the same Wi-Fi; `--phone` wires the Mac's LAN IP, `localhost` will not work from a device |
| `flutter run` fails: no simulator | the simulators were deleted on purpose; use `--phone`, or re-download a runtime in Xcode → Settings → Components |
| No "Sign in with SSO" button | workspace SSO is off (Admin → SSO), or auth-service was recreated without the override (someone ran compose without it) — re-run `./scripts/dev/up.sh --sso` |
| `/auth/oidc/login` answers 500 | auth-service tried discovery while Keycloak was down and keeps that failure — `docker restart auth-service` (keeps the OIDC env) |
| SSO sign-in bounces back to `/login` with an error | usually the email's domain is not in Admin → SSO → Allowed email domains (the redirect on the way back was `/oauth-callback?error=SSO_DOMAIN_NOT_ALLOWED`) |
| `keycloak.localhost` does not open | use Chrome, Edge or Firefox (Safari does not resolve `*.localhost`); the mobile app on a phone cannot reach it at all |

## What's in here

| File | Purpose |
|---|---|
| `up.sh` | one-shot bring-up: compose, health waits, seeding, web, Flutter |
| `seed-users.js` | test accounts written straight to Mongo with a real bcrypt hash (deliberately not via `/auth/register`, which needs a live MX record and sends a real OTP email) |
| `seed-chat.js` | fake conversations: call-log pills, legacy `call_log` rows, an `extbot:*` assistant DM, an archived DM, a group |
| `seed-company/` | the fake company **NovaTech Solutions** — see below |
| `keycloak/compose.sso.yml` | `--sso` override: the Keycloak container + OIDC env and `extra_hosts` for auth-service |
| `keycloak/realm-pon.json` | realm `pon`: client `pon-auth`, `groups` mapper, groups `staff`/`admins`, users alice/bob/carol@pon.local |
| `keycloak/add-user.sh` | add / update / `--remove` a user in the running realm (for demoing with a real address that must not be committed) |
| `keycloak/workspace-sso.js` | mongosh shortcut for Admin → SSO: enabled, allowed domains, staff → Member, admins → Admin |

## Fake company: NovaTech Solutions

`--seed` also builds a whole company so every flow can be tested without
creating data by hand. Re-run it on its own any time (idempotent — it wipes
and rebuilds only its own data, tracked in the `dev_seed_manifest` collection):

```bash
node scripts/dev/seed-company/index.js           # (re)seed
node scripts/dev/seed-company/index.js --reset   # remove the company only
```

| What | Details |
|---|---|
| Workspace | renamed *NovaTech Solutions*, AI persona "Nova", daily digest 8:00, connector allow-list |
| 8 departments | Ban Giám đốc, Kỹ thuật, Sản phẩm & Thiết kế, Kinh doanh, Marketing, Nhân sự, Tài chính - Kế toán, CSKH — each with a lead |
| 22 employees | `<name>@novatech.local` / `Devpass123!`, all 4 roles (Owner `quan.nguyen`, Admin `ha.tran` / `huy.huynh` / `nhung.vu`, Managers = department leads), avatars, one **blocked** account (`teo.nguyen`). `dev` / `alice` / `bob` join Kỹ thuật |
| Invitations | 2 pending, 1 revoked, 1 expired |
| AI context | company + per-department entries, incl. `VIEW_INTERNAL_CONTEXT` / `VIEW_CONFIDENTIAL_CONTEXT`-gated ones (log in as different roles to compare answers); personal context for 6 people |
| 21 conversations | 8 department groups (with `departmentId` → dept-scoped RAG), a public company channel, a cross-department project group, a muted social group, DMs (unread, call logs, disappearing, archived, a pending message request), an AI chat, DMs between other employees |
| Messages | text, replies, reactions, mentions, pinned, edited, recalled, system codes, files, images, AI answers with traces, a meeting-summary card |
| Files + KB | Markdown, TXT, CSV, a real PDF and PNGs in GridFS; 7 of them registered as KB docs and embedded by ai-service (needs Redis + a Voyage key; otherwise they stay `pending`) |
| AI data | reminders, long-term memory, 30 days of token usage, thumbs up/down feedback |
| Admin | friend requests + notifications, audit-log entries |

Log out and back in after seeding — role and department claims live in the JWT.
Running `seed-chat.js` alone deletes every conversation `dev` is in, including
the company's; re-run `seed-company` afterwards.
