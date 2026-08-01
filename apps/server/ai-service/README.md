# ai-service

NestJS microservice (port **3002**) that runs the PON AI assistant: the agentic Claude loop, long-term
memory, RAG over uploaded documents, and the per-user MCP tools merged in from `connector-service`.
Part of the [PON](../../../README.md) monorepo.

It is **not** an HTTP-first service. The main entry point is the RabbitMQ queue `ai.requests`; the few
REST routes exist for health, usage dashboards and session inspection.

## Responsibility

| Module | What it does |
|---|---|
| `ai` | The agentic loop: builds the prompt, calls Anthropic Claude, streams the answer, runs the tool loop, retries on overload with the fallback model |
| `ai-context` | Role-aware context block — workspace/department/member facts read from the shared collections and injected into the system prompt |
| `memory` | Long-term facts: extraction every N turns, dedup, half-life decay, stored in Mongo + a Qdrant memory collection |
| `kb` | Knowledge Base / RAG: parses PDF·DOCX·TXT, chunks, embeds via Voyage AI, upserts to Qdrant, hybrid retrieval with a score threshold |
| `tools` | Built-in tools (reminders, web search, …) plus the per-user MCP tools fetched from connector-service |
| `skills` | Reads `user_skills` to decide which capability bundles are on for this member |
| `persona` | Per-conversation AI persona (name + instructions) |
| `session` | Assembles the message pairs sent to the Anthropic API |
| `usage` | Token accounting, per-user monthly quota, cost estimate, quality dashboard |
| `scheduler` | Due reminders and the optional daily digest, delivered as real in-chat AI messages |
| `retention` | Periodic sweep that expires old memory/derived data |
| `call` | AI notetaker for group calls — transcribes and posts a summary back |
| `settings`, `health` | Runtime settings; `GET /health` |

## Message bus — the real API

| Direction | Channel | Payload |
|---|---|---|
| **consume** | RabbitMQ queue `ai.requests` (exchange `ai.direct`, key `ai.request`) | `{conversationId, userId, displayName, content, history[]}` |
| **publish** | Redis `ai:response:{conversationId}` | `{type: AI_STREAM_CHUNK \| AI_STREAM_DONE \| AI_STREAM_ERROR, chunk?, fullContent?}` |
| **subscribe** | Redis `kb:process`, `kb:delete` | KB indexing / deletion jobs |

`ai.requests` is declared durable with a 30 s TTL and dead-letters to `ai.requests.dlq` via
`ai.dead-letter`. chat-service declares the same topology — **the arguments must match on both sides**,
or `QueueDeclare` fails with `406 PRECONDITION_FAILED` and this service crash-loops. If that happens
after an older build left an arg-less queue behind, delete the queue and let it be redeclared.

## REST routes

| Route | Purpose |
|---|---|
| `GET /health` | liveness |
| `GET /usage/...` | token usage + admin quality dashboard |
| `/api/sessions/...` | session inspection |

Swagger UI: `http://localhost:3002/docs`.

## Configuration

See `.env.example` — the service reads ~77 vars, most of them optional feature toggles. The ones that
actually matter:

```env
PORT=3002
MONGODB_URI=mongodb://localhost:27018/platform    # shared `platform` db, port 27018 (non-standard)
REDIS_HOST=localhost
RABBITMQ_URL=amqp://platform:platform@localhost:5672
JWT_ACCESS_SECRET=...                             # identical across every service
ANTHROPIC_API_KEY=sk-ant-...
QDRANT_URL=http://localhost:6333
VOYAGE_API_KEY=...                                # unset ⇒ embeddings off ⇒ RAG + memory degrade
CONNECTOR_INTERNAL_URL=http://localhost:3003      # per-user MCP tools
INTERNAL_API_KEY=...                              # must match connector-service
```

Feature groups, all env-driven: `ANTHROPIC_ROUTER_*` (route simple/mid/complex prompts to different
models), `AI_PROMPT_CACHE_*` / `AI_RESPONSE_CACHE_*`, `AI_RATE_*` (per-user rate limit),
`CHAT_VISION_*` / `KB_VISION_*` (image + scanned-PDF understanding), `WEB_SEARCH_*`,
`MEMORY_*` (extraction cadence, dedup threshold, half-life), `KB_*` (top-k, score threshold, hybrid),
`AI_DIGEST_*`, `AI_RETENTION_*`, `AI_MONTHLY_TOKEN_LIMIT`.

> **Careful with `ANTHROPIC_EFFORT`**: not every model accepts an effort/output-config parameter —
> sending it to one that doesn't returns 400 and the user just sees "AI is temporarily unavailable".
> Gate it per model.

## Develop

```bash
pnpm --filter @platform/ai-service start:dev
pnpm --filter @platform/ai-service test
pnpm --filter @platform/ai-service build
```

Use the full package name: a `--filter` that matches nothing exits 0 with no output, so a typo looks
exactly like a passing run.

Cloud Run note: the RabbitMQ consumer needs a live CPU. With CPU throttling on, the connection is
dropped while idle (`consumers=0`) and AI goes silent with no client-side error — deploy with
`--no-cpu-throttling` and `--min-instances=1`.

## Quality / evals

`eval/` holds the offline prompt-quality harness and its recorded baseline — see
[`eval/README.md`](eval/README.md).

## Reference

- Coding rules: `.claude/rules/ai-service.md`
- Bus contract + ports: root [`CLAUDE.md`](../../../CLAUDE.md)
- Tracing across chat → queue → ai → Redis: [`docs/observability.md`](../../../docs/observability.md)
