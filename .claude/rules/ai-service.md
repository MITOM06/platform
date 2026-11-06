---
paths:
  - "apps/server/ai-service/**"
---

# ai-service — NestJS AI Layer Rules

## Tech Stack

- **NestJS** (TypeScript) — same pattern as auth-service
- **@anthropic-ai/sdk** — Anthropic Claude API, native streaming
- **@golevelup/nestjs-rabbitmq** — AMQP consumer for AI request jobs (`@RabbitSubscribe`)
- **ioredis** — Redis pub/sub for response streaming (use `ioredis`, NOT the `redis` package)
- **@nestjs/mongoose + mongoose** — persist AI messages to MongoDB
- **pnpm** — package manager (NOT npm, NOT yarn)
- Port: **3002**

## Project Structure

One module per domain. Full per-module description: [`README.md`](../../apps/server/ai-service/README.md).

```
apps/server/ai-service/src/
  app.module.ts                  — wires the modules below
  main.ts                        — bootstrap, port 3002
  swagger.ts                     — Swagger UI at /docs
  tracing.ts                     — OpenTelemetry init (must load before Nest)
  config/configuration.ts        — typed env config via ConfigService
  ai/                            — agentic Claude loop, streaming, ai.consumer.ts (@RabbitSubscribe)
  ai-context/                    — role-aware workspace/department/member context block
  memory/                        — long-term fact extraction, dedup, decay
  kb/                            — RAG: parse → chunk → embed (Voyage) → Qdrant → retrieve
  tools/                         — built-in tools + per-user MCP tools from connector-service
  skills/                        — capability bundles, reads `user_skills`
  persona/                       — per-conversation AI persona
  session/                       — builds the Anthropic message list
  usage/                         — token accounting, quota, cost, quality dashboard
  scheduler/                     — due reminders + daily digest
  retention/                     — periodic expiry sweep of derived data
  call/                          — group-call AI notetaker
  settings/  health/             — runtime settings; GET /health
  rabbitmq/                      — AmqpConnection + queue/exchange declaration
  redis/                         — SUBSCRIBE kb:process|kb:delete, PUBLISH ai:response:{convId}
  bot/                           — OnApplicationBootstrap: seed the AI bot user
  eval/                          — offline prompt-quality harness + baseline
```

## Environment Variables

```env
PORT=3002
JWT_ACCESS_SECRET=...
MONGODB_URI=mongodb://localhost:27018/platform
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_URL=amqp://platform:platform@localhost:5672
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
ANTHROPIC_FALLBACK_MODEL=claude-haiku-4-5-20251001
AI_BOT_USER_ID=ai-bot-000000000000000000000001
AI_BOT_DISPLAY_NAME=PON AI
REDIS_AI_RESPONSE_PREFIX=ai:response
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=             # only for a managed cluster; a local container has no auth
VOYAGE_API_KEY=...          # Voyage AI embeddings (RAG/memory); unset = RAG off
# 4-series only: Voyage's 200M free tokens do not apply to voyage-3.5 or any
# other older model, so the default decides free vs billed from the first call.
KB_EMBEDDING_MODEL=voyage-4-lite
```

## Message Bus Protocol

### RabbitMQ CONSUME: `ai.requests` queue (replaces Redis `ai:request`)

Consumed via `AiConsumer` decorated with `@RabbitSubscribe`:
```json
{
  "conversationId": "string",
  "userId": "string",
  "displayName": "string",
  "content": "string (with @AI stripped out)",
  "history": [
    { "role": "user", "content": "string" },
    { "role": "assistant", "content": "string" }
  ]
}
```

### Redis PUBLISH: `ai:response:{conversationId}` (unchanged — low-latency streaming)
```json
{ "type": "AI_STREAM_CHUNK", "chunk": "string" }
{ "type": "AI_STREAM_DONE",  "fullContent": "string" }
{ "type": "AI_STREAM_ERROR", "error": "string" }
```

### Redis SUBSCRIBE (remaining channels)
- `kb:process` — Knowledge Base indexing jobs
- `kb:delete` — Knowledge Base deletion jobs

## Code Conventions

- **Module pattern**: one module per domain — do NOT pile everything into AppModule
- **Dependency injection**: constructor injection + `@Injectable()`, NEVER `new` directly
- **Config**: use `ConfigService` from `@nestjs/config` — NEVER `process.env.X` directly inside a service
- **Error handling**: always try/catch around Claude API calls; publish `AI_STREAM_ERROR` on failure — NEVER let the process crash
- **Fallback model**: if primary model returns 529/overloaded → retry once with `ANTHROPIC_FALLBACK_MODEL`
- **Logging**: use NestJS `Logger` — NEVER `console.log`
- **File size**: max 300 lines/file — split service if exceeded

## Bot User Identity

- `AI_BOT_USER_ID = ai-bot-000000000000000000000001` (24-char ObjectId-compatible string)
- Seeded into MongoDB `users` collection on boot (idempotent upsert)
- Fields: `{ _id, displayName, email: "ai@platform.internal", isBot: true, avatarUrl: null }`
- chat-service uses this userId when saving AI messages to MongoDB

## System Prompt Template

```
You are PON AI, an intelligent assistant embedded in the PON chat platform.
You are helping {{displayName}} in a conversation.
Be helpful, concise, and friendly. Respond in the same language the user writes in.
If you don't know something, say so clearly.
```

## Claude Streaming Pattern

```typescript
const stream = await this.anthropic.messages.stream({
  model: this.configService.get('ANTHROPIC_MODEL'),
  max_tokens: 2048,
  system: systemPrompt,
  messages: [...history, { role: 'user', content: content }],
});

for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
    await this.publisher.publish(convId, { type: 'AI_STREAM_CHUNK', chunk: chunk.delta.text });
  }
}
await this.publisher.publish(convId, { type: 'AI_STREAM_DONE', fullContent: fullText });
```

## Meeting context (M3)

- A request with `payload.meetingId` (chat-service, `@AI` in the meeting chat, `conversationId = "meeting:{id}"`) or a post-meeting group chat (`conversations.meetingId`) gets a meeting block from `MeetingContextService.blockFor` (record fetched AS the asker): trusted instruction + summary then record inside `wrapUntrusted('Meeting record')`, <= 60 000 chars (`meeting/meeting-context.ts`). No access -> trusted "no access" line; fetch error -> "temporarily unavailable" line; neither carries content.
- Any request with a meeting block skips the response cache (lookup and store).
- Tools `list_my_meetings({query?})` and `get_meeting_record({meetingId, question?})` (`tools/`): offered ONLY in the 1-1 chat with the AI (`ToolContext.directAi`, from `ConversationContext.directAi === true`); outside it `execute` returns `"Meeting not found."` (same string for no access / unknown / invalid id). Always use `ctx.userId`, never an id from input. Results are `wrapUntrusted`, record capped at 30 000 chars, not result-cached (`NEVER_CACHED_TOOLS`). Fetch/list errors -> `"Meeting records are temporarily unavailable."`.
- `meeting:` conversations get NO tools (`RequestContext.noTools`): the reply is shown to the whole room but tools would run with the asker's permissions. Post-meeting groups keep normal group-chat tools.

## Testing

- Run: `pnpm test` (Jest)
- Mock `@anthropic-ai/sdk` in unit tests — NEVER call real API in tests
- Mock `ioredis` with `ioredis-mock`
- Mock `@golevelup/nestjs-rabbitmq` `AmqpConnection` with a jest mock object
- After every change: `pnpm build && pnpm test`

## Meeting material (M4)
- `meet:material` (chat-service, a file sent in the meeting chat) -> `MeetingMaterialService` (`meeting/`): claim `meet:material:claim:{messageId}` (NX, EX 3600), fetch `resolveUploadUrl('/api/uploads/'+uploadId, chat.internalUrl)` with `internalUploadHeaders` via `common/fetch-upload-capped.ts` (redirects refused, 20 MB cap on Content-Length AND while streaming, one 20 s timeout over the whole body), then publish `meet:material:result` (`ok` + text <= 6000 chars surrogate-safe | `unsupported` | `failed`). `chat-image.service.ts` keeps its own fetch.
- Routing sniffs by mime, file extension and magic bytes (chat-service mime may be null/generic): PDF/DOCX/`text/*` -> `DocumentExtractorService.extractText` (short PDF text is kept; no `describePdf`, cost); jpeg/png/gif/webp -> `VisionDescribeService.describeImage` (>5 MB or vision unavailable -> `unsupported`). Everything else and empty text -> `unsupported`; extractor/fetch errors -> `failed`.
- Vision goes ONLY through the Anthropic API (`VisionDescribeService`); never add another provider for file reading. Logs carry ids only, never file content.

