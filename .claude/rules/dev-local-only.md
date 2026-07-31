# Rule — Local Dev Setup & Fake Data Never Reach `main`

> `main` is the production branch: it is what gets built and deployed. Anything
> whose only purpose is to make the app runnable or testable on a laptop stays on
> the shared local-test branch (`dev`) and **must never be committed to, merged
> into, or cherry-picked onto `main`**. Violations are release blockers.

## The Rule

When implementing a feature or fix, the deliverable that goes to `main` is the
feature itself. Everything created purely to *run* or *demo* it locally stays on
`dev`, where other members pull it, test, and only then promote the feature.

**Never on `main`:**

1. **Fake / seed / demo data** — seed scripts, fixture users, sample
   conversations, mock messages, `scripts/dev/seed-*.js`, anything that writes
   invented rows into Mongo. Production data comes from real users only.
2. **Test accounts & throwaway credentials** — `*@pon.local` users, shared dev
   passwords, hardcoded bcrypt hashes, pre-verified accounts.
3. **Local bring-up tooling** — `scripts/dev/up.sh` and friends, one-shot dev
   launchers, log dirs (`.dev-logs/`), local tunnels.
4. **Localhost / LAN wiring** — `apps/web/.env.development.local`, dart-define
   values pointing at `localhost` or a LAN IP, `NEXT_PUBLIC_*` overrides,
   loosened CORS origins, dev-only compose overrides.
5. **Debug conveniences** — auth bypasses, OTP short-circuits, disabled rate
   limits, verbose logging switched on by default, `enabled: false` guards
   flipped for testing.

**Belongs on `main` as normal:**

- The feature / bugfix itself, its tests, and its i18n keys.
- Production config that is *genuinely missing* (e.g. a required env var the code
  now reads) — commit it with a **production-safe** default or no default at
  all, never with a localhost value baked in.
- Code that merely *allows* a local override while defaulting to production
  behaviour is acceptable, but keep it on `dev` unless it is needed by the
  feature. If in doubt, it stays on `dev`.

## Workflow

```
feature branch  →  merge into dev  →  members test locally on dev
                                   →  promote ONLY the feature commits to main
```

- Keep dev-env changes in **separate commits** from feature changes, so
  promoting to `main` is a clean cherry-pick of the feature commits and never
  drags the setup along.
- Never `git merge dev` into `main`. Promote by cherry-picking, or open a PR from
  a feature branch that was cut from `main`.
- Prefer paths that make the split obvious: dev-only code under `scripts/dev/`,
  dev-only env in `*.development.local` / gitignored files.
- Before any PR into `main`, check the diff for the five categories above:
  `git diff main...HEAD --stat` — if you see `scripts/dev/`, a seed script, a
  `.local` env file, or a `localhost` string, it does not belong in that PR.

## Why

Seeded users are real login credentials once they land in a production database,
fake conversations corrupt real analytics and can be shown to real users, and a
localhost/relaxed-CORS value that ships to production either breaks the deploy
or opens it up. Keeping all of it on `dev` means teammates get a one-command
local environment while `main` stays deployable at every commit.
