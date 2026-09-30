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

Every change is **debugged and tested on `dev` first, and only reaches `main`
after it passes there.** `dev` is `main` plus the local-env commits; features
flow *through* it, but `dev` itself never flows into `main`.

```
          feat/x  (cut from main — contains only the feature)
         │      │
  1. test│      │ 3. promote (PR feat/x → main) once dev testing passes
         ▼      ▼
        dev    main  ──────►  (production, always deployable)
         ▲                │
         └────────────────┘ 2. sync: main flows into dev
```

**1 — Set up once.** `git checkout dev && ./scripts/dev/up.sh --seed`

**2 — Keep `dev` current.** Merge `main` *into* `dev` — never rebase a shared
branch, that forces everyone to reset:

```bash
git checkout dev
git fetch origin
git merge origin/main          # dev = latest main + the env commits
git push origin dev
```

**3 — Build the feature on its own branch, cut from `main`.** The branch must
contain only feature commits, so it can later go to `main` as-is:

```bash
git fetch origin
git checkout -b feat/x origin/main
# ...code, unit tests...
git push -u origin feat/x
```

**4 — Debug and test on `dev`.** Merge the feature branch into `dev`, run the
full local stack, and let the team test it there:

```bash
git checkout dev
git merge --no-ff feat/x
./scripts/dev/up.sh --build      # rebuild images with the feature
git push origin dev              # teammates pull dev and test too
```

Bugs found on `dev` are fixed **on `feat/x`** (not on `dev`), then merged into
`dev` again. Repeat until it passes.

**5 — Promote to `main` only after it passed on `dev`.** Open the PR from
`feat/x` into `main`. Check the diff first:

```bash
git diff origin/main...feat/x --stat     # must show ONLY your feature's files
```

If that diff lists `scripts/dev/`, a seed script, a `*.local` env file or a
`localhost` string, stop — a dev-only change got mixed into a feature commit.

- Never `git merge dev` into `main`, never open a PR from `dev`, and never
  commit a feature directly on `dev` — `dev` carries seed data, test accounts
  and localhost wiring that must not reach production (see *Why*).
- Keep dev-env changes in **separate commits** on `dev`, never inside a feature
  branch.
- A feature branch that was (by mistake) cut from `dev` must be moved onto
  `main` **before** its first merge into `dev`:
  `git rebase --onto origin/main dev feat/x` — after the merge that range is
  empty and the replay silently does nothing.
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
