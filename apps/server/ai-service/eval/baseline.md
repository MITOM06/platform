# PON AI Eval — Baseline

This document records the reference baseline for the LLM-as-judge eval harness
(`run-eval.ts` + `dataset.jsonl`). Run the harness before significant prompt or
model changes and compare against this baseline to catch quality regressions.

> The harness is a **manual pre-change check**, not a CI gate — it always exits 0
> (see `README.md`). Treat the numbers here as a guardrail, not a hard threshold.

## What the dataset covers

14 cases across 5 categories, each with an explicit, checkable rubric graded by a
Haiku judge (`pass` / `fail` + reason):

| Category | Cases | What is tested |
|---|---|---|
| `rag_grounding` | 3 | Answer uses only the provided context; no hallucination beyond it |
| `refusal` | 3 | Declines harmful / privacy-violating requests, offers a safe alternative |
| `persona_tone` | 3 | Stays in the PON AI persona; replies in the user's language |
| `factual` | 2 | Technically accurate answers on general CS topics |
| `instruction_following` | 3 | Respects explicit format / length / output constraints |

## How to run

```bash
cd apps/server/ai-service
ANTHROPIC_API_KEY=sk-ant-... pnpm eval
```

Optional overrides (see `README.md` for the full list):

```bash
EVAL_SUT_MODEL=claude-sonnet-4-6 EVAL_JUDGE_MODEL=claude-haiku-4-5 \
  ANTHROPIC_API_KEY=... pnpm eval
```

- **SUT model** (system under test) default: `claude-opus-4-8`
- **Judge model** default: `claude-haiku-4-5`

The harness prints a per-case results table and a category summary. No infra
(Redis / RabbitMQ / Qdrant) is required — grounding context is injected directly
from the dataset.

## Baseline scores

Fill in the pass rate per category after a clean run on the default models. Record
the SUT model, judge model, and date so future runs are comparable. `PENDING`
means a full scored run against real Anthropic APIs has not yet been captured in
this repo (the harness requires a live `ANTHROPIC_API_KEY`).

**Run metadata**

| Field | Value |
|---|---|
| Date | _PENDING_ |
| SUT model | `claude-opus-4-8` |
| Judge model | `claude-haiku-4-5` |
| Harness commit | _PENDING_ |

**Results**

| Category | Cases | Passed | Pass rate |
|---|---|---|---|
| `rag_grounding` | 3 | _PENDING_ | _PENDING_ |
| `refusal` | 3 | _PENDING_ | _PENDING_ |
| `persona_tone` | 3 | _PENDING_ | _PENDING_ |
| `factual` | 2 | _PENDING_ | _PENDING_ |
| `instruction_following` | 3 | _PENDING_ | _PENDING_ |
| **Total** | **14** | _PENDING_ | _PENDING_ |

## Expectations & interpretation

- On the default `claude-opus-4-8` SUT, expect a high pass rate (target ≥ 12/14).
  A drop below the recorded baseline after a prompt/model change is a regression
  signal — inspect the failing cases' judge reasons before shipping.
- `ERROR` rows (API/timeout) are not failures; re-run flaky cases. If a category
  consistently errors, investigate connectivity / rate limits, not answer quality.
- When you add or change dataset cases, update the counts and re-capture the
  baseline in the same commit so the table stays authoritative.
