## Backend Implementation Report — TASK-13 Usage & Quality Dashboard

### Summary
Implemented the admin-only aggregate endpoint `GET /usage/dashboard` in **ai-service** (port 3002). It rolls up token volume + per-day series + top users (from `token_usage`), per-model estimated cost (from `messages.trace`, env-driven price map), and the 👎 feedback rate + worst-rated answers (from `ai_feedback`). Gated by the existing `MANAGE_WORKSPACE` capability via the shared `JwtAuthGuard` + `RequirePermissionGuard`. **This is the first ai-service controller to use the shared auth guards** — wiring detailed below.

---

### 변경된 파일 (changed files)

**New:**
- `apps/server/ai-service/src/usage/message.schema.ts` — read-only Mongoose model over shared `messages` (fields: `senderId`, `conversationId`, `content`, `createdAt`, embedded `trace.{model,inputTokens,outputTokens}`). ai-service never writes it.
- `apps/server/ai-service/src/usage/feedback.schema.ts` — read-only model over shared `ai_feedback` (`messageId, conversationId, userId, rating, comment, createdAt`). Written by chat-service only.
- `apps/server/ai-service/src/usage/dashboard.types.ts` — frozen `DashboardResponse` contract + sub-types (single source of truth for clients).
- `apps/server/ai-service/src/usage/cost-estimator.ts` — pure `estimateCost(perModelTokens, prices)` (no DB/DI), unit-tested.
- `apps/server/ai-service/src/usage/dashboard.service.ts` — aggregation service (`getDashboard({month?, days?})`); 3 sources, parallel queries. ~290 lines (under the 500 limit; pure cost math already split out).
- `apps/server/ai-service/src/usage/usage.controller.ts` — `@Controller('usage')`, `GET /dashboard` gated; controller only parses query + delegates.
- `apps/server/ai-service/src/usage/dashboard.service.spec.ts` — 12 unit tests (cost math, fallback price, sort, empty-data, 👎 rate, top-users + pro-rated cost + displayName fallback, date-range zero-fill, worst-answer join + 200-char preview, default 30d window, month-wins-over-days, malformed-month 400).

**Modified:**
- `apps/server/ai-service/src/config/configuration.ts` — added `pricing` block + `buildPriceMap()` + `priceEnvKey()` + exported `ModelPrice` interface.
- `apps/server/ai-service/src/usage/usage.module.ts` — registered `Message`/`Feedback` schemas, `controllers: [UsageController]`, provided `DashboardService`.
- `apps/server/ai-service/src/app.module.ts` — added `PassportModule.register({ defaultStrategy: 'jwt' })` + `SharedJwtStrategy` provider (so `JwtAuthGuard` can populate `req.user`).
- `apps/server/ai-service/package.json` — added deps `@platform/database` (workspace:*), `@nestjs/passport`, `passport`, `passport-jwt`, devDep `@types/passport-jwt`; added jest `moduleNameMapper` for `@platform/database`.
- `apps/server/ai-service/tsconfig.json` — added `paths` alias for `@platform/database` (mirrors connector-service).
- `apps/server/ai-service/.env.example` — documented the pricing env vars.

---

### Frozen `GET /usage/dashboard` response shape (clients MUST match)

```jsonc
{
  "range": { "from": "2026-06-01", "to": "2026-06-30", "label": "2026-06" },  // label = "YYYY-MM" or "last Nd"
  "totals": {
    "inputTokens": 1840000,
    "outputTokens": 642000,
    "totalTokens": 2482000,        // authoritative volume (token_usage)
    "requestCount": 1213,
    "estimatedCostUsd": 12.47      // == sum(perModelCost[].costUsd), model-aware (messages.trace)
  },
  "daily": [                        // one entry PER DAY in range, zero-filled gaps
    { "date": "2026-06-01", "inputTokens": 52000, "outputTokens": 18000, "totalTokens": 70000, "requestCount": 41 }
  ],
  "perModelCost": [                 // one per distinct model in window, sorted by costUsd desc
    {
      "model": "claude-opus-4-8",
      "inputTokens": 900000,
      "outputTokens": 380000,
      "requestCount": 210,
      "inputPricePerMTok": 15.0,    // resolved from price map (echoed)
      "outputPricePerMTok": 75.0,
      "costUsd": 42.0               // round(2)
    }
  ],
  "topUsers": [                     // token_usage grouped by userId, desc, top 10; bot excluded
    { "userId": "665...", "displayName": "Alice", "totalTokens": 410000, "requestCount": 88, "estimatedCostUsd": 3.10 }
    // displayName best-effort from users collection, falls back to userId
    // estimatedCostUsd = pro-rated share of totals.estimatedCostUsd by token proportion, round(2)
  ],
  "feedback": {
    "up": 142,
    "down": 17,
    "total": 159,                   // up+down in window
    "thumbsDownRate": 0.1069,       // down/total in 0..1; 0 when total==0 (never NaN)
    "worstAnswers": [               // most-recent down-rated, limit 10
      {
        "messageId": "667...",
        "conversationId": "661...",
        "comment": "Wrong total ...",            // string | null
        "answerPreview": "The total is $4,210 ...", // first 200 chars of messages.content; "" if message gone
        "createdAt": "2026-06-21T08:14:00.000Z"  // ISO string | null
      }
    ]
  }
}
```

**Query params:** `month` (`YYYY-MM`, optional, validated `^\d{4}-\d{2}$` → **400** on malformed) and `days` (number, optional, default 30). `month` wins when both given.

**Contract note carried from plan:** `totals.totalTokens`/`requestCount` come from `token_usage` (authoritative volume, includes non-trace usage); `totals.estimatedCostUsd` is the model-aware sum of `perModelCost` from `messages.trace`. The two token sources can differ slightly by design — documented in `dashboard.service.ts` JSDoc.

---

### Env vars added (per-model price map)

Format: `AI_PRICE_<MODELKEY>_IN` / `AI_PRICE_<MODELKEY>_OUT` (USD per 1M tokens), where `<MODELKEY>` = model id upper-cased with non-alphanumerics → `_` (e.g. `claude-opus-4-8` → `AI_PRICE_CLAUDE_OPUS_4_8_IN`).

| Var | Default | Purpose |
|-----|---------|---------|
| `AI_PRICE_DEFAULT_IN` | `3` | input price for any model not in the seeded map |
| `AI_PRICE_DEFAULT_OUT` | `15` | output price for any model not in the seeded map |
| `AI_PRICE_CLAUDE_HAIKU_4_5_IN/_OUT` | `1` / `5` | seeded default (router simple tier) |
| `AI_PRICE_CLAUDE_SONNET_4_6_IN/_OUT` | `3` / `15` | seeded default (router mid tier) |
| `AI_PRICE_CLAUDE_OPUS_4_8_IN/_OUT` | `15` / `75` | seeded default (router complex tier) |

Seeded defaults are baked in (`configuration.ts buildPriceMap()`); env vars override per deployment. Unknown models fall back to `AI_PRICE_DEFAULT_*` — cost is never silently dropped. Documented in `.env.example`.

---

### Gating confirmation (B-note resolved)

- **Capability:** existing `Capability.MANAGE_WORKSPACE` — no new capability invented, no auth-service change.
- **Guards:** `@UseGuards(JwtAuthGuard, RequirePermissionGuard)` on the controller + `@RequirePermission(Capability.MANAGE_WORKSPACE)` on the route. Both imported from `@platform/database` (same barrel connector-service uses).
- **JWT wiring (the integration risk):** ai-service had NOT used these guards before and was missing the deps + path alias. Resolved by mirroring connector-service exactly:
  1. Added `@platform/database` (workspace:*), `@nestjs/passport`, `passport`, `passport-jwt` to `package.json`; ran `pnpm install` (workspace link created).
  2. Added `@platform/database` `paths` alias to `tsconfig.json` (build) + jest `moduleNameMapper` (tests).
  3. Registered `PassportModule.register({ defaultStrategy: 'jwt' })` and `SharedJwtStrategy` provider in `app.module.ts` so `JwtAuthGuard` populates `req.user` from the Bearer token (HS256, same `JWT_ACCESS_SECRET`).
  4. `RequirePermissionGuard` reads `req.user.perms` (the JWT `perms` claim auth-service issues) the same way connector-service does → **403 `{ code: 'INSUFFICIENT_PERMISSION', required: 'MANAGE_WORKSPACE' }`** when lacking the cap; **401** when unauthenticated; missing `perms` (pre-enterprise token) → denied.
- **No bypass.** The endpoint is gated correctly; nothing deferred on the auth path.

---

### 빌드/테스트 결과 (exact)

- `pnpm --filter ai-service build` → **PASS** (`nest build`, no errors).
- `pnpm --filter ai-service test` → **PASS** — `Test Suites: 29 passed, 29 total` / `Tests: 255 passed, 255 total` (0 failures; the 12 new dashboard tests included). The new spec in isolation: `npx jest dashboard.service` → `Test Suites: 1 passed` / `Tests: 12 passed`.
- `pnpm install` → success; `@platform/database` workspace link + passport deps added (+32 packages).

---

### API 엔드포인트 구현 확인
- `GET /usage/dashboard?month=YYYY-MM&days=N` — implemented, gated by `MANAGE_WORKSPACE`.

---

### Deferrals / risks / notes for clients
- **`topUsers[].estimatedCostUsd` is pro-rated, not exact.** `token_usage` has no model field, so a per-user model-aware cost is impossible from that source. Each user's cost = `(userTotalTokens / allTokens) * totals.estimatedCostUsd`, round(2). Documented in service JSDoc. (Plan didn't pin the per-user cost formula; this is the only honest option without a schema change. Flag for the contract if a different split is wanted.)
- **displayName resolution** queries the shared `users` collection directly via the Mongoose connection (raw collection query), only for valid 24-char ObjectId userIds — avoids coupling to the full `@platform/database` User schema (which has `_id:false` on subdocs). Misses fall back to `userId`. The AI bot user is excluded from `topUsers`.
- **Index:** per the plan, the `messages` per-model aggregation is bounded by date range; existing compound indexes on `messages` cover `conversationId`-led queries but NOT `{senderId, createdAt}`. Did **NOT** add a new index (plan says defer unless QA flags latency, and avoid the prod auto-index trap). If QA shows latency, add `{ senderId: 1, createdAt: 1 }` explicitly.
- **No new collections, no writes** to any shared collection — all three sources read-only.
- **Mobile (D6):** plan accepts a minimal read-only mobile mirror; that is a client task, not backend.
