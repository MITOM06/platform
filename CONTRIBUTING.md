# Contributing

Setting up the project for the first time? Read **[ONBOARDING.md](ONBOARDING.md)** —
it covers prerequisites, which branch to clone (it is not `main`), what to run,
and what to ask the repo owner for. This file is the rules you work by once it
runs.

## Branches

`main` is the deployed branch. `dev` is `main` plus the commits that make the app
runnable on a laptop — bring-up script, seed data, localhost wiring — and those
must never reach `main` (`.claude/rules/dev-local-only.md`, enforced by
`scripts/ci/check-dev-only.sh`).

- Cut your branch from `dev`: `git checkout -b feat/<scope> dev`
- Naming: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`, `docs/<scope>`
- Keep dev-env changes in **separate commits** from feature changes — the
  promotion step below depends on it.
- Promote by replaying only your commits onto `main`:

  ```bash
  git fetch origin
  git rebase --onto origin/main dev feat/<scope>
  git diff origin/main...feat/<scope> --stat   # must list ONLY your files
  git push -u origin feat/<scope>              # then open the PR into main
  ```

- PRs target `main`. Never merge `dev` into `main`, and never open a PR from `dev`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`.

## Before you open a PR

CI must be green. Run it locally first — the full list of gates and their
commands is in [ONBOARDING.md § 5](ONBOARDING.md#5-tests-and-ci-gates).

Two review rules that reject more PRs than anything else:

- **Cross-platform sync** (`.claude/rules/sync.md`) — this is a messaging app; a
  feature that lands on web but not mobile, or the reverse, is a P1 bug. Read the
  mirror file before you write anything.
- **No raw system data in the UI** (`.claude/rules/no-raw-system-data-in-ui.md`) —
  no exception text, system message codes, user ids, storage URLs or JSON in
  anything a user can see. Humanize and localize at the source, on both clients.

## Code style

**Flutter (`apps/client`)**
- Feature-based layout: `lib/features/<name>/{data,domain,ui}/`
- Riverpod for all state — no `setState` in feature screens
- Every UI string via `context.l10n.<key>`, and every new key added to **all seven**
  `lib/l10n/app_*.arb` files (`.claude/rules/i18n.md`)
- `flutter analyze` must report 0 issues

**Spring Boot (`apps/server/chat-service`)**
- Constructor injection + `@RequiredArgsConstructor` — no field `@Autowired`
- `jakarta.*` imports only, never `javax.*`
- DTOs for every API response — never expose a `@Document` entity
- Run `mvn spotless:apply` after editing Java: spotless is bound to
  `test-compile`, so `mvn compile` can pass while `spotless:check` fails

**NestJS (`auth-service`, `ai-service`, `connector-service`)**
- TypeScript strict mode; no `any`, no unjustified `eslint-disable`
- Module structure, services injected via constructor
- Controllers parse and delegate — business logic lives in services

**Next.js (`apps/web`)**
- App Router only; Server Components by default, `'use client'` only when needed
- TanStack Query for server data, Zustand for auth state, `useState` for UI state
- All HTTP through `lib/api/axios.ts` instances — never raw `fetch` for API calls
- Full rules: `.claude/rules/web.md`

**Both clients**
- Never hardcode a backend host. Read it from `AppConfig` (Flutter) or
  `lib/config/env.ts` (web); `scripts/ci/check-env-leaks.sh` fails the build
  otherwise, with no exemptions.

## File-length limits

| Layer | Max lines |
|---|---|
| Flutter UI screen / widget | 400 |
| NestJS / Spring service or controller | 500 |
| ai-service files | 300 |

Split rather than exceed — `.claude/rules/clean-code.md` describes how.
