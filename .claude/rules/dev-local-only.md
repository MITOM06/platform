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

`dev` is **one-way**: it is `main` plus the local-env commits, and it never flows
back. Code moves `feature → main`; `main` flows *into* `dev`, never out of it.

```
        main  ──────────────────────────────►  (production, always deployable)
          │  ▲                             ▲
   sync   │  │ promote (feature only)       │
          ▼  │                              │
        dev  ──────────► feat/x ────────────┘
      (main + env)     (cut from dev,
                        so you have the stack)
```

**1 — Set up once.** `git checkout dev && ./scripts/dev/up.sh --seed`

**2 — Get the latest code from everyone else, keeping your env.** Merge `main`
*into* `dev` — do not rebase a shared branch, that forces everyone to reset:

```bash
git checkout dev
git fetch origin
git merge origin/main          # dev = latest main + the env commits
git push origin dev
```

**3 — Build your feature.** Branch from `dev` so the local stack is present:

```bash
git checkout -b feat/x dev
# ...code, run ./scripts/dev/up.sh, test on localhost / your phone...
```

**4 — Promote to `main` without the env commits.** Replay only your own commits
onto `main` — `--onto` drops everything `feat/x` inherited from `dev`:

```bash
git fetch origin
git rebase --onto origin/main dev feat/x
git diff origin/main...feat/x --stat     # must show ONLY your feature's files
git push -u origin feat/x                # then open the PR into main
```

If that diff lists `scripts/dev/`, a seed script, a `*.local` env file or a
`localhost` string, stop — the rebase base was wrong, or a dev-only change got
mixed into a feature commit.

- Keep dev-env changes in **separate commits** from feature changes; step 4 works
  precisely because the two never share a commit.
- Never `git merge dev` into `main`, and never open a PR from `dev`.
- Prefer paths that make the split obvious: dev-only code under `scripts/dev/`,
  dev-only env in `*.development.local` / gitignored files.
- `dev` staying permanently a few commits ahead of `main` is the expected steady
  state, not debt to clean up.

## Why

Seeded users are real login credentials once they land in a production database,
fake conversations corrupt real analytics and can be shown to real users, and a
localhost/relaxed-CORS value that ships to production either breaks the deploy
or opens it up. Keeping all of it on `dev` means teammates get a one-command
local environment while `main` stays deployable at every commit.
