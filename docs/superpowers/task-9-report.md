# Task 9 Report — LLM-as-Judge Eval Harness

## Files Created

| File | Description |
|---|---|
| `apps/server/ai-service/eval/dataset.jsonl` | 14 eval cases, one JSON object per line |
| `apps/server/ai-service/eval/run-eval.ts` | Runner script: calls SUT model, grades with Haiku judge, prints table |
| `apps/server/ai-service/eval/README.md` | How to run, cost estimate, extension guide |
| `apps/server/ai-service/tsconfig.build.json` | Excludes `eval/` from `nest build` |

Modified:
| File | Change |
|---|---|
| `apps/server/ai-service/package.json` | Added `"eval": "ts-node eval/run-eval.ts"` script |

## Dataset

14 cases across 5 categories:

| Category | Count | What is tested |
|---|---|---|
| `rag_grounding` | 3 | Answer uses provided context; refuses to hallucinate outside it |
| `refusal` | 3 | Declines private data access, credential requests, phishing generation |
| `persona_tone` | 3 | Resists jailbreak, matches user language (Chinese test), stays in persona |
| `factual` | 2 | TCP/UDP differences, HTTP 429 status code |
| `instruction_following` | 3 | Exact list count, exact sentence count, JSON-only output |

## Runner + Judge Design

**SUT call**: `callSut()` builds the production system persona + optional grounding context injected inline (no RAG/Redis/Qdrant required). Calls the SUT model (`EVAL_SUT_MODEL`, default `claude-opus-4-8`) and returns the text response.

**Judge call**: `callJudge()` sends the rubric, user prompt, optional context, and SUT answer to Haiku (`claude-haiku-4-5`). Haiku is called plainly — no thinking, no effort param (not supported). Returns `{pass: boolean, reason: string}` via robust JSON extraction (handles markdown wrapping). If the judge produces non-JSON output, the case is marked FAIL with a descriptive reason rather than crashing.

**Resilience**: each case is wrapped in try/catch; failures are marked `ERROR` and the run continues. Exit code is always 0 — it's a report tool, not a CI gate.

**Env overrides**: `EVAL_SUT_MODEL` and `EVAL_JUDGE_MODEL` allow ad-hoc model comparison without editing code.

## Verification Output

```
pnpm install        → Done in 1.8s (clean)
tsc --noEmit        → clean (only pnpm field warning, no type errors)
dataset parse-check → 14 cases OK
jest --ci           → Test Suites: 11 passed, 11 total | Tests: 89 passed, 89 total
```

Eval not picked up by jest (`rootDir: src`, `testRegex: .*\.spec\.ts$`).
`nest build` excludes eval via `tsconfig.build.json` (`exclude: ["eval"]`).

## Commit

`7ff3e739` — feat(ai): add LLM-as-judge eval harness + dataset for AI answer quality
