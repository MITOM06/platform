# Onboarding

Welcome to **PON** — a self-hosted enterprise AI-assistant platform: realtime chat
where every member gets a personal AI that can *act* for them through governed
MCP connectors.

This is the one page for getting the project running and contributing to it. For
what the product is and how it fits together, read [README.md](README.md); for
code style and PR rules, [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 1. Which branch do I clone?

**`dev`.** Not `main`.

```
        main  ───────────────────────────────►  production; always deployable
          │  ▲
   sync   │  │ promote (rebase --onto — feature commits only)
          ▼  │
        dev  ──────────►  feat/your-thing
   (main + local env)     (cut from dev, so the stack is there)
```

`main` is what gets deployed. Everything whose only job is to make the app *run
on a laptop* — the bring-up script, seed data, test accounts, localhost wiring —
lives on `dev` and must never reach `main`. `dev` is `main` plus those commits,
and it only ever flows one way. The full rule is
[`.claude/rules/dev-local-only.md`](.claude/rules/dev-local-only.md); CI enforces
it (`scripts/ci/check-dev-only.sh`).

So: clone, `git checkout dev`, and cut your feature branch from `dev`.

---

## 2. Get it running

### Prerequisites

| Tool | Needed for |
|---|---|
| Docker Desktop | everything — Mongo, Redis, RabbitMQ, Qdrant and the four services |
| Node 20+ and pnpm 9 (`corepack enable`) | the web app, the seed script, any NestJS service you run from source |
| Flutter SDK 3.44 | only if you work on the mobile app |
| Xcode | only for iOS builds |
| Java 21 + Maven | only if you run chat-service from source — path B below |

### Path A — one command (what almost everyone wants)

```bash
git clone https://github.com/MITOM06/platform.git
cd platform
git checkout dev
pnpm install

cp infra/docker-compose/.env.example     infra/docker-compose/.env
cp apps/server/auth-service/.env.example apps/server/auth-service/.env
cp apps/web/.env.example                 apps/web/.env.local

./scripts/dev/up.sh --seed
```

`up.sh` brings up the whole stack in Docker, waits for each service to be
healthy, seeds test data, writes `apps/web/.env.development.local` and starts the
web dev server. Log in at <http://localhost:3000> as `dev@pon.local` /
`Devpass123!`.

Mobile: `./scripts/dev/up.sh --phone` (real device over the LAN — lightest) or
`--flutter` (iOS simulator).

Flags and troubleshooting live with the script itself, on the `dev` branch:
[`scripts/dev/README.md`](https://github.com/MITOM06/platform/blob/dev/scripts/dev/README.md).
(Both are dev-only, so they are not on `main` — that is the rule in section 1
working as intended, not a missing file.)

**What you need from the repo owner.** Only the third-party keys; the signing
secrets are generated per machine:

| Value | Without it |
|---|---|
| `ANTHROPIC_API_KEY` | the assistant stays silent |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` | registration fails — the OTP email never sends |
| `VOYAGE_API_KEY` *(optional)* | RAG and long-term memory are off; chat still works |
| `GOOGLE_*` / `NOTION_*` *(optional)* | those connectors do not appear |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` *(optional)* | no push notifications |

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`,
`CONNECTOR_VAULT_KEY` and `INTERNAL_API_KEY` are **generated per machine** by
`up.sh` into `infra/docker-compose/.env.dev-secrets` (gitignored). Never ask for
the production values and never paste them in: a token signed with the
production secret on your laptop is accepted by the live API, and the production
vault key decrypts every user's stored OAuth tokens.

### Path B — running a service from source (hot reload)

Take this path only when you are actively editing one backend service and want
`start:dev` reloading. `compose.yml` contains **both** the infrastructure and the
four services, so start the infrastructure *by name* — a bare `up -d` starts the
services too and the two processes fight over the same port.

```bash
docker compose -f infra/docker-compose/compose.yml up -d \
  mongo mongo-setup redis rabbitmq qdrant jaeger

# One .env per service. All four must carry the SAME JWT_ACCESS_SECRET, and
# ai-service + connector-service the same INTERNAL_API_KEY, or requests fail
# with a 401 that looks like a login bug.
cp apps/server/auth-service/.env.example      apps/server/auth-service/.env
cp apps/server/ai-service/.env.example        apps/server/ai-service/.env
cp apps/server/connector-service/.env.example apps/server/connector-service/.env
cp apps/web/.env.example                      apps/web/.env.local

# connector-service refuses to boot unless CONNECTOR_VAULT_KEY base64-decodes to
# exactly 32 bytes:
openssl rand -base64 32

# chat-service reads application.yml and takes the secret from the environment:
export JWT_ACCESS_SECRET=<the same value as the .env files>
```

Then, one terminal each:

```bash
cd apps/server/auth-service      && pnpm start:dev      # :3001
cd apps/server/ai-service        && pnpm start:dev      # :3002
cd apps/server/connector-service && pnpm start:dev      # :3003
cd apps/server/chat-service      && mvn spring-boot:run # :8080
cd apps/web                      && pnpm dev            # :3000
```

If you mix paths — services in Docker *and* from source — stop the Docker ones
first: `docker compose -f infra/docker-compose/compose.yml stop auth-service
chat-service ai-service connector-service`.

### Infrastructure at a glance

| Service | Address |
|---|---|
| MongoDB | `mongodb://localhost:27018` — port **27018**, not 27017 |
| Redis | `redis://localhost:6379` |
| RabbitMQ | AMQP `localhost:5672` · UI <http://localhost:15672> (`platform`/`platform`) |
| Qdrant | <http://localhost:6333> |
| Jaeger (tracing) | <http://localhost:16686> |

---

## 3. Environments

Local and production are separated by configuration alone — the same commit runs
in both, and promoting it is an environment change, never a code change. Read
[docs/environments.md](docs/environments.md) before touching anything that names
an address.

Each client resolves every backend URL from **one** value:

| | Local | Deployed |
|---|---|---|
| Web | `apps/web/.env.development.local` (written by `up.sh`) | `NEXT_PUBLIC_API_BASE` |
| Mobile | `--dart-define=PON_CHAT_URL=http://…` | `--dart-define=PON_DOMAIN=<host>` |

Per-service overrides (`NEXT_PUBLIC_CHAT_URL`, `PON_CHAT_URL`, …) win
individually — that is how you point one service at your machine while the rest
stay remote.

Two things that will bite you if you forget them:

- **Never hardcode a host in source.** `scripts/ci/check-env-leaks.sh` fails the
  build over it, with no exemptions. A hardcoded production host is invisible
  when you run locally — the app just quietly talks to production.
- **Never commit local setup to `main`.** Keep dev-env changes in separate
  commits from feature changes; section 4 depends on it.

---

## 4. Working on a feature

```bash
git checkout dev
git fetch origin && git merge origin/main   # latest code, your env untouched
git checkout -b feat/your-thing dev
# ...code, run ./scripts/dev/up.sh, test...
```

Promote to `main` by replaying **only your commits** — `--onto` drops everything
the branch inherited from `dev`:

```bash
git fetch origin
git rebase --onto origin/main dev feat/your-thing
git diff origin/main...feat/your-thing --stat   # must list ONLY your files
git push -u origin feat/your-thing              # then open the PR into main
```

If that diff shows `scripts/dev/`, a seed script, a `*.local` env file or a
`localhost` string, stop — the rebase base was wrong, or a dev-only change got
mixed into a feature commit.

Before you open the PR, run what CI runs (section 5). Two rules the reviewers
will hold you to:

- **Cross-platform sync.** This is a messaging app: a feature that works on web
  but not mobile (or the reverse) is a P1 bug. Read the mirror file before you
  start — [`.claude/rules/sync.md`](.claude/rules/sync.md) lists the pairs.
- **Never show raw system data.** No error text, message codes, user ids, URLs or
  JSON in the UI — humanize and localize at the source. See
  [`.claude/rules/no-raw-system-data-in-ui.md`](.claude/rules/no-raw-system-data-in-ui.md).

---

## 5. Tests and CI gates

Every job below runs on every pull request into `main`. Run them locally first.

| Gate | Command |
|---|---|
| Secret scan (gitleaks) | — (CI only) |
| Environment separation | `bash scripts/ci/check-env-leaks.sh`<br>`bash scripts/ci/check-dev-only.sh`<br>`bash scripts/ci/check-env-parity.sh` |
| auth-service | `cd apps/server/auth-service && pnpm test` |
| chat-service | `cd apps/server/chat-service && mvn test` *(Testcontainers pulls images on first run)* |
| connector-service | `cd apps/server/connector-service && pnpm test` |
| ai-service | `cd apps/server/ai-service && pnpm test` |
| web | `cd apps/web && pnpm exec tsc --noEmit && pnpm run lint && pnpm test && pnpm build` |
| Flutter | `cd apps/client && flutter analyze && flutter test` |

chat-service also runs `spotless` (google-java-format) bound to `test-compile`:
`mvn compile` can pass while `spotless:check` fails, so run `mvn spotless:apply`
after editing Java.

### AI eval harness — before changing the assistant

`apps/server/ai-service/eval/` is an LLM-as-judge harness over 14 cases (RAG
grounding, refusal, persona, factual, instruction-following). It is a manual
pre-change check, not a CI gate. Run it before changing the system prompt,
upgrading the primary model, or touching the agentic loop.

```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter ai-service eval
```

See [apps/server/ai-service/eval/README.md](apps/server/ai-service/eval/README.md).

### Tracing an AI request

One `@AI` message produces a single trace across chat-service → RabbitMQ →
ai-service → Redis → STOMP. Open <http://localhost:16686>, pick `chat-service` or
`ai-service`, and look for `ai.request.publish`, `agentic_loop`,
`ai.response.deliver`. Protocol: [docs/observability.md](docs/observability.md).

---

## 6. Conventions

**Package managers.** pnpm for all JS/TS (`pnpm-workspace.yaml`), `flutter pub`
for mobile, Maven for chat-service. Never `npm` or `yarn`.

**Ports.** auth 3001 · ai 3002 · connector 3003 · chat 8080 · web 3000 ·
Mongo 27018.

**Shared secrets.** `JWT_ACCESS_SECRET` must be identical across all four
services; `INTERNAL_API_KEY` identical between ai-service and connector-service.
Changing one without the others produces 401s that look like login bugs.

**Error codes are the contract.** auth-service returns
`{ "code": "AUTH_INVALID_CREDENTIALS", ... }`, not localized text. Clients map
codes to strings — Flutter `lib/features/auth/utils/auth_error.dart`, web
`lib/auth/auth-error.ts`. The list is [docs/auth-error-codes.md](docs/auth-error-codes.md).
Never render a raw code.

**i18n.** Seven languages on mobile (`lib/l10n/app_*.arb` — add the key to *all*
of them) and `messages/*.json` on web. No hardcoded UI strings; see
[`.claude/rules/i18n.md`](.claude/rules/i18n.md).

**File length.** Flutter screens/widgets 400 lines, NestJS/Spring services and
controllers 500 (ai-service 300). Split rather than exceed —
[`.claude/rules/clean-code.md`](.claude/rules/clean-code.md).

**Where things live** — see the repository map in [README.md](README.md#-repository-structure).

---

## 7. If you are an AI coding agent

1. Read `CLAUDE.md` and the sub-service `CLAUDE.md` before touching code.
2. The rules in `.claude/rules/` are not advisory — `sync.md`,
   `no-raw-system-data-in-ui.md`, `dev-local-only.md` and `i18n.md` each
   correspond to a class of bug that has shipped before.
3. Never commit to `main` directly; never open a PR from `dev`.
4. `apps/server/auth-service/` is fully editable
   (`.claude/rules/auth-guard.md`).
5. Current state and roadmap: [docs/roadmap.md](docs/roadmap.md) and
   [docs/superpowers/PON-ENTERPRISE-HANDOFF.md](docs/superpowers/PON-ENTERPRISE-HANDOFF.md).
