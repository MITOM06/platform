# PON AI Eval Harness

LLM-as-judge eval harness for the PON AI service. Measures answer quality on a fixed dataset so prompt/model changes can be checked for regression before deployment.

## How to Run

```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter ai-service eval
```

Or from inside the service directory:

```bash
cd apps/server/ai-service
ANTHROPIC_API_KEY=sk-ant-... pnpm eval
```

Override the system-under-test model or judge model via env:

```bash
EVAL_SUT_MODEL=claude-sonnet-4-6 EVAL_JUDGE_MODEL=claude-haiku-4-5 ANTHROPIC_API_KEY=... pnpm eval
```

## What It Measures

The harness runs 14 test cases across 5 categories:

| Category | Cases | What is tested |
|---|---|---|
| `rag_grounding` | 3 | Answer uses provided context; no hallucination outside it |
| `refusal` | 3 | Model declines harmful/privacy-violating requests |
| `persona_tone` | 3 | Stays in PON AI persona; matches user language |
| `factual` | 2 | Technically accurate answers on CS topics |
| `instruction_following` | 3 | Respects format/length/output constraints |

Each case has an explicit, checkable rubric. The judge (Haiku) grades pass/fail with a brief reason.

## Architecture

```
dataset.jsonl  ──► callSut()  ──► SUT model answer
                                       │
                                  callJudge()  ──► Haiku grades {pass, reason}
                                                        │
                                              results table + summary
```

- **SUT model** (`EVAL_SUT_MODEL`, default `claude-opus-4-8`): called with a lean version of the production system prompt + optional grounding context. No RAG/Redis/Qdrant required — context is injected directly from the dataset.
- **Judge model** (`EVAL_JUDGE_MODEL`, default `claude-haiku-4-5`): called plainly (no thinking, no effort param — Haiku does not support those). Returns a JSON `{pass: boolean, reason: string}`.
- **Resilience**: if any single case throws (API error, timeout), it is marked `ERROR` and the run continues. Exit code is always 0 — this is a report tool, not a CI gate.

## Cost Estimate

Each full run (~14 cases) costs roughly:
- SUT calls (Opus 4.8): ~14 × ~300 input + ~200 output tokens ≈ 7K input / 3K output
- Judge calls (Haiku): ~14 × ~500 input + ~50 output tokens ≈ 7K input / 0.7K output

Total: well under $1 per run at current pricing. Run it before significant prompt or model changes.

## When to Run

This is a **manual pre-change check** — NOT wired into CI. Run it:
- Before changing the system prompt in `PersonaService`
- Before upgrading the primary or fallback model
- Before shipping changes to the agentic loop (`AiService._agenticLoop`)
- After changing refusal or grounding logic

## How to Extend

### Add a new test case

Append a JSON line to `eval/dataset.jsonl`:

```jsonc
{
  "id": "my-category-N",
  "category": "my_category",
  "prompt": "User question here",
  "context": "Optional grounding text the answer must use (leave empty string if none)",
  "rubric": "Specific checkable criteria: what must be present, what must be absent."
}
```

Rubrics should be explicit and verifiable — not "answer should be good" but "answer must state X, must NOT do Y, must use format Z."

### Full-pipeline eval (future)

To test the complete stack (RabbitMQ → ai-service → Redis streaming → chat-service):

1. Start infra: `docker compose -f infra/docker-compose/compose.yml up -d`
2. Start both services
3. Publish a message to `ai.requests` queue (AMQP) with a known `conversationId`
4. Subscribe to `ai:response:{conversationId}` on Redis; collect chunks until `AI_STREAM_DONE`
5. Feed the collected answer to the same Haiku judge

The current harness intentionally skips this to stay cheap and fast. Use it to catch prompt-level regressions; use integration tests for pipeline correctness.
