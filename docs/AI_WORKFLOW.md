# AI_WORKFLOW.md — AI-Assisted Development Workflow

> How this repo is built and maintained with **Claude Code** (Anthropic's CLI). This supersedes
> the old Gemini-Planner / Claude-Coder / `TODO.md` loop, which is no longer used.

## 1. Tools

| Tool | Role |
|------|------|
| **Claude Code** (`claude` CLI) | Primary implementer + reviewer across all five apps (auth / chat / ai / connector services + Flutter + web). Runs autonomously per `CLAUDE.md` (AUTONOMOUS MODE). |
| **Skills** | Reusable, packaged procedures Claude invokes for a given kind of task (see §3). Combine the `superpowers:*` skill library with this project's own skills. |
| **Plans** | Written specs under `docs/superpowers/plans/` that drive multi-step work. |
| **Handoff doc** | `docs/superpowers/PON-ENTERPRISE-HANDOFF.md` — the authoritative project state + roadmap. Read it first when picking up work. |

## 2. The Loop

```text
① READ STATE            → docs/superpowers/PON-ENTERPRISE-HANDOFF.md + relevant plan
② PLAN (if non-trivial) → writing-plans / brainstorming → plan file in docs/superpowers/plans/
③ IMPLEMENT             → orchestrate-feature / implement-feature (all platforms at once)
④ VERIFY                → build + test per service; qc-debug for a full-project sweep
⑤ SYNC                  → sync-check (web ↔ mobile parity)
⑥ RECORD               → session-summary appends to .claude/ai-activity.md
```

Claude runs ①–⑥ autonomously and reports once at the end (per `CLAUDE.md`), stopping only for the
HARD STOP situations listed there (ambiguous scope, breaking API/contract changes, missing
secrets, irreversible actions, or a genuine architectural fork).

## 3. Key Skills

| Skill | When to use |
|-------|-------------|
| `orchestrate-feature` | Implement a feature end-to-end across backend + Flutter + web simultaneously. The default entry point for any "add functionality / new screen / new endpoint" request. |
| `implement-feature` | Implement a single feature end-to-end (plan → code → verify) when full multi-platform orchestration isn't needed. |
| `qc-debug` | Full-project QC & debug sweep — build all services, hunt regressions, fix them. |
| `sync-check` | Verify Flutter mobile and Next.js web are in sync (same message types, STOMP events, endpoints, i18n keys). Run after implementing on one platform. |
| `session-summary` | Append a summary of the session to `.claude/ai-activity.md`. Run before `/clear` or when finishing. |
| `superpowers:*` | Cross-cutting engineering skills — `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, etc. |

Trigger mapping also lives in `CLAUDE.md` (하네스 section): feature requests → `orchestrate-feature`;
platform-sync checks → `sync-check`; simple questions → answer directly.

## 4. Where State Lives

- **Roadmap + current state:** `docs/superpowers/PON-ENTERPRISE-HANDOFF.md`
- **Plans / specs:** `docs/superpowers/plans/`, `docs/superpowers/specs/`
- **Direction notes:** `docs/superpowers/BOTFACTORY-BRIDGE-DIRECTION.md`, session handoffs
- **Cross-session memory:** `.claude/ai-activity.md` (append-only via `session-summary`)
- **Architecture / decisions / API:** `docs/architecture.md`, `docs/decisions.md`, `docs/api-spec.md`
- **Rules Claude must follow:** `CLAUDE.md`, sub-service `CLAUDE.md` files, and `.claude/rules/*.md`
  (sync, i18n, clean-code, no-raw-system-data-in-ui, web, ai-service …).

## 5. Principles

- **Verify before claiming done** — run the actual build/test, don't assert success (see
  `superpowers:verification-before-completion`).
- **Keep web and mobile in lockstep** — a feature on one platform only is considered broken
  (`.claude/rules/sync.md`).
- **Record every session** — `.claude/ai-activity.md` is the durable memory across `/clear`.
- **Read the plan, not the whole repo** — the handoff doc + the relevant plan file are enough
  context to start; expand from there as needed.
