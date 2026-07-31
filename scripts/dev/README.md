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

```bash
git checkout -b feat/x dev     # branch off dev so the stack is present
# ...code and test...
```

To promote it to `main` **without** dragging the dev setup along:

```bash
git fetch origin
git rebase --onto origin/main dev feat/x
git diff origin/main...feat/x --stat    # must list ONLY your feature's files
git push -u origin feat/x               # then open the PR into main
```

If that diff shows `scripts/dev/`, a seed script or a `*.local` env file, stop —
see `.claude/rules/dev-local-only.md`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `missing infra/docker-compose/.env` | step 3 above |
| chat-service never comes up | usually `ALLOWED_ORIGINS` or Mongo: `docker logs chat-service` |
| ai-service restarts forever, 406 `PRECONDITION_FAILED` | a stale `ai.requests` queue; `up.sh` fixes this automatically on start |
| Web shows prod data | `apps/web/.env.development.local` is missing or the dev server was started before it existed — restart `pnpm web` |
| Phone can't reach the backend | it must be on the same Wi-Fi; `--phone` wires the Mac's LAN IP, `localhost` will not work from a device |
| `flutter run` fails: no simulator | the simulators were deleted on purpose; use `--phone`, or re-download a runtime in Xcode → Settings → Components |

## What's in here

| File | Purpose |
|---|---|
| `up.sh` | one-shot bring-up: compose, health waits, seeding, web, Flutter |
| `seed-users.js` | test accounts written straight to Mongo with a real bcrypt hash (deliberately not via `/auth/register`, which needs a live MX record and sends a real OTP email) |
| `seed-chat.js` | fake conversations: call-log pills, legacy `call_log` rows, an `extbot:*` assistant DM, an archived DM, a group |
