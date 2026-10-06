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
| `actions` | Sensitive connector writes held for the requester's in-chat confirmation; confirm/cancel API, follow-up reply |
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
| **publish** | Redis `ai:response:{conversationId}` | `{type: AI_STREAM_CHUNK \| AI_TOOL_CALL \| AI_ACTION_PENDING \| AI_STREAM_DONE \| AI_STREAM_ERROR, …}` — every event carries `conversationId`, `replyId`, `requesterId` |
| **publish** | Redis `ai:action:resolved` | `{actionId, conversationId, replyId, status: confirmed \| failed \| cancelled, resultSummary?}` |
| **subscribe** | Redis `kb:process`, `kb:delete` | KB indexing / deletion jobs |
| **subscribe** | Redis `ai:memory:delete` | `{conversationId, userId}` (both required) — drop that member's memory vectors |

`ai.requests` is declared durable with a 30 s TTL and dead-letters to `ai.requests.dlq` via
`ai.dead-letter`. chat-service declares the same topology — **the arguments must match on both sides**,
or `QueueDeclare` fails with `406 PRECONDITION_FAILED` and this service crash-loops. If that happens
after an older build left an arg-less queue behind, delete the queue and let it be redeclared.

## REST routes

| Route | Purpose |
|---|---|
| `GET /health` | liveness |
| `GET /usage/quota` | the caller's monthly quota `{used, limit, periodStart, periodEnd}` (JWT) |
| `GET /usage/dashboard` | admin usage & quality dashboard (`MANAGE_WORKSPACE`) |
| `POST /ai/actions/:id/confirm` | run a pending action once with its stored input → `{status: confirmed \| failed}` (JWT, requester only) |
| `POST /ai/actions/:id/cancel` | drop a pending action → `{status: cancelled}` (JWT, requester only) |
| `/api/sessions/...` | session inspection |

Through the mini's Caddy every route is under `/api/ai` (e.g. `/api/ai/ai/actions/:id/confirm`).
Swagger UI: `http://localhost:3002/docs`.

## Confirming sensitive actions

connector-service lists every non-read-only tool with `sensitive: true` (`GET /internal/tools`). The loop
never runs such a tool itself — unless its name is in the low-risk allow-list (`create_draft`); built-in
tools never need confirmation. Instead it:

1. stores `ai:pending-action:{id}` (requester, conversation, reply, tool, **input**, humanized `summary`,
   `expiresAt` = now + `AI_PENDING_ACTION_TTL_SEC`),
2. answers the tool call with "waiting for the user's confirmation — not performed",
3. publishes `AI_ACTION_PENDING {action}` and lists the action in that reply's `AI_STREAM_DONE.pendingActions`.

`action` = `{id, toolName, provider, summary: {kind, …}, status: "pending", expiresAt}`; `summary.kind` is
`send_email | draft_email` (`to`, `subject`), `create_event | update_event` (`title`, `start`, `end`),
`create_page | update_page` (`title`) or `generic` (`tool`) — no bodies, ids or links, lengths capped.

Confirm/cancel check ownership first (403 `ACTION_NOT_OWNER`, nothing consumed), then take a single-use
claim (409 `ACTION_ALREADY_RESOLVED`); unknown → 404 `ACTION_NOT_FOUND`, past `expiresAt` → 410
`ACTION_EXPIRED`. Confirm runs the **stored** input through the connector client (the body is never read),
publishes `ai:action:resolved` and posts a short follow-up AI reply (new `replyId`, persona, usage
recorded). A connector tool the model asks for that was not offered in the request is refused, and a reply
that ends in an error drops its pending actions.

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
CHAT_INTERNAL_URL=http://localhost:8080           # Docker: http://chat-service:8080
```

Tuning added with the 2026-10 QC sweep (defaults shown):

| Var | Default | Effect |
|---|---|---|
| `AI_HISTORY_WINDOW` | `20` | latest AI-session turns sent verbatim (older ones only via the compacted summary; `0` = no cap) |
| `AI_GROUP_CONTEXT_MESSAGES` | `20` | latest group/DM messages shown to the AI as attributed context when @mentioned |
| `CHAT_VISION_FETCH_TIMEOUT_MS` | `10000` | per-image fetch budget for chat vision |
| `CONNECTOR_READ_TIMEOUT_MS` | `5000` | connector tool listing + read-only calls |
| `CONNECTOR_WRITE_TIMEOUT_MS` | `30000` | connector writes; a timed-out write is reported as "may have happened", never retried |
| `AI_PENDING_ACTION_TTL_SEC` | `600` | how long a sensitive action waits for confirmation (the Redis key lives 5 min longer for the 410) |
| `AI_TIMEZONE` | `Asia/Ho_Chi_Minh` | clock, reminder times without offset, daily-digest day window |

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
