---
paths:
  - "apps/server/ai-service/**"
---

# ai-service — NestJS AI Layer Rules

## Tech Stack

- **NestJS** (TypeScript) — same pattern as auth-service
- **@anthropic-ai/sdk** — Anthropic Claude API, native streaming
- **ioredis** — Redis pub/sub (use `ioredis`, NOT the `redis` package)
- **@nestjs/mongoose + mongoose** — persist AI messages to MongoDB
- **pnpm** — package manager (NOT npm, NOT yarn)
- Port: **3002**

## Project Structure

```
apps/server/ai-service/src/
  app.module.ts
  main.ts                        — bootstrap, port 3002
  config/
    configuration.ts             — typed env config via ConfigService
  ai/
    ai.module.ts
    ai.service.ts                — Claude API call + streaming logic
    ai.controller.ts             — health endpoint GET /health
  redis/
    redis.module.ts
    redis-subscriber.service.ts  — SUBSCRIBE ai:request
    redis-publisher.service.ts   — PUBLISH ai:response:{convId}
  bot/
    bot-seed.service.ts          — OnApplicationBootstrap: seed AI bot user
```

## Environment Variables

```env
PORT=3002
JWT_ACCESS_SECRET=...
MONGODB_URI=mongodb://localhost:27018/platform
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
ANTHROPIC_FALLBACK_MODEL=claude-haiku-4-5-20251001
AI_BOT_USER_ID=ai-bot-000000000000000000000001
AI_BOT_DISPLAY_NAME=PON AI
REDIS_AI_REQUEST_CHANNEL=ai:request
REDIS_AI_RESPONSE_PREFIX=ai:response
```

## Redis Pub/Sub Protocol

### SUBSCRIBE: `ai:request`
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

### PUBLISH: `ai:response:{conversationId}`
```json
{ "type": "AI_STREAM_CHUNK", "chunk": "string" }
{ "type": "AI_STREAM_DONE",  "fullContent": "string" }
{ "type": "AI_STREAM_ERROR", "error": "string" }
```

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

## Testing

- Run: `pnpm test` (Jest)
- Mock `@anthropic-ai/sdk` in unit tests — NEVER call real API in tests
- Mock `ioredis` with `ioredis-mock`
- After every change: `pnpm build && pnpm test`
