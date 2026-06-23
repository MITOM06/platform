## Feature: TASK-13 — Usage & Quality Dashboard (single admin view)

### Summary
Add an admin-only aggregate endpoint in **ai-service** that rolls up, for a chosen month (or last-N-days window): total + per-day tokens & request count, top users by tokens, estimated cost broken down per model (env-configurable price map), and the 👎 feedback rate plus the worst-rated answers. Surface it as **one web page under `/admin/usage`** (gated by `MANAGE_WORKSPACE`), reusing the visual language of the existing `/token-usage` page. This is a web-primary admin/ops surface — mobile gets a minimal read-only mirror panel (see Mobile + sync rationale).

---

### Key Decisions (resolved — not open)

**D1 — Endpoint home = ai-service (port 3002), NEW module surface in `src/usage/`.**
Justification: ai-service already *owns the write path* for `token_usage` (`ai.service.ts:309 → UsageService.recordUsage`), already reads the shared `conversations` collection (`conversation.schema.ts`), and already reads `ai_feedback` in its eval tooling (`eval/import-feedback.ts`). It also holds the model-routing knowledge (`model-router.ts`) and is the natural owner of the per-model price map. The task spec also explicitly scopes files to `apps/server/ai-service/src/usage/*`. chat-service merely *reads* `token_usage` for the existing personal page — we leave that untouched.

**D2 — Per-model price config lives in ai-service `configuration.ts` as an env-driven map** (NOT `Workspace.aiSettings`).
Justification: prices are deployment/billing constants that change rarely and are operationally owned (not behavioral toggles an admin tunes per workspace). TASK-12's `Workspace.aiSettings` is for *behavior* (persona/tone/model tier/quota). Putting a price table there would split ops config and add request-path DB reads for a constant. Env map keeps it simple, overridable per deployment, and out of the hot path. Graceful default applies when a model isn't in the map.

**D3 — Gate with the EXISTING `MANAGE_WORKSPACE` capability. Do NOT invent a new capability.**
Justification: TASK-12 already placed every AI-admin surface (AI settings, SSO, workspace) behind `MANAGE_WORKSPACE` on all 3 platforms; the admin console section list (web `ADMIN_SECTIONS`, Flutter `adminSections`) uses it. `VIEW_AUDIT_LOG` is for the audit log specifically; a fresh `VIEW_USAGE_ANALYTICS` cap would require touching `packages/database/rbac`, role seeds, and the JWT `perms` claim across services for zero SMB benefit. `MANAGE_WORKSPACE` is the right-sized single-admin gate. **This is the first ai-service controller to use `@RequirePermission` — see B-note.**

**D4 — Dashboard home = web `/admin/usage` (new admin-console section), NOT an extension of `/token-usage`.**
Justification: `/token-usage` is a *personal, self-scoped, ungated* page (any user sees their own tokens, served by chat-service). TASK-13 is a *cross-user, admin-gated* view. Bolting cross-user aggregates onto the personal page would either leak data or require conditional rendering. Consistent with where TASK-12 put AI admin (`/admin/ai`), the dashboard belongs in the admin console at `/admin/usage`, gated by `RequireCap cap="MANAGE_WORKSPACE"`. We *reuse the visual components* (stat cards, CSS/canvas bars, progress styling) from `/token-usage` as the base — satisfying the backlog's "reuse existing /token-usage page as the base" intent without merging concerns.

**D5 — Cost-by-model source = the `messages` collection's `trace` subdocument, NOT `token_usage`.**
Critical data-shape finding: `token_usage` daily rows (`userId, date, inputTokens, outputTokens, requestCount`) have **no model field**. The only place token counts are correlated with a model is `messages.trace` (`AiTraceData`: `model`, `inputTokens`, `outputTokens`, per AI message). So: tokens/requests over-time + top-users come from the efficient pre-aggregated `token_usage`; **per-model cost** is computed by aggregating `messages` where `senderId == AI_BOT_USER_ID` and `trace` exists, grouped by `trace.model`, within the window. ai-service adds a lightweight read-only `Message` schema (collection `messages`) — it already does this pattern for `conversations`.

**D6 — Mobile = minimal read-only mirror panel; web-primary deviation accepted.**
Justification (explicit sync-rule deviation per `.claude/rules/sync.md`): TASK-13 is an **admin/ops dashboard, not a chat/messaging surface**. The sync rule's hard P1 cases are message types and STOMP chat events — this is neither. Full chart parity on mobile is low-value for a single admin who will operate from web. We keep mobile honest with a **minimal `UsageDashboardPanel`** in the existing Flutter admin section (`MANAGE_WORKSPACE`) showing the headline numbers (this-month tokens, estimated cost, 👎 rate, top-5 users, worst-5 answers as a list) reusing the same endpoint — no charts. This preserves "feature exists on both platforms" while not over-investing. State the deviation in the QA report.

---

### Backend (ai-service — NestJS, port 3002)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/server/ai-service/src/config/configuration.ts` | 수정 | Add `pricing` block: env-driven per-model USD/1M-token map + defaults (see Data Model / API). |
| `apps/server/ai-service/src/usage/message.schema.ts` | 신규 | Read-only Mongoose model for shared `messages` collection (fields used: `senderId`, `conversationId`, `content`, `createdAt`, `trace.{model,inputTokens,outputTokens}`). Mirror the existing read-only `conversation.schema.ts` pattern. |
| `apps/server/ai-service/src/usage/feedback.schema.ts` | 신규 | Read-only Mongoose model for shared `ai_feedback` collection (`messageId, conversationId, userId, rating('up'\|'down'), comment, createdAt`). ai-service NEVER writes it (chat-service owns writes). |
| `apps/server/ai-service/src/usage/dashboard.service.ts` | 신규 | Aggregation service. Method `getDashboard(params: { month?: string; days?: number })` → assembles the full payload (see API Contract). Uses 3 aggregations: (a) `token_usage` group-by-date + group-by-user(top N); (b) `messages` group-by `trace.model` for token sums → cost via price map; (c) `ai_feedback` up/down counts + worst answers (down-rated, join answer text from `messages`). Keep < 300 lines; if it grows, split cost calc into `cost-estimator.ts`. |
| `apps/server/ai-service/src/usage/cost-estimator.ts` | 신규 | Pure function `estimateCost(perModelTokens, priceMap)` → `{ perModel: [...], totalUsd }`. Unit-tested (no DB). |
| `apps/server/ai-service/src/usage/usage.controller.ts` | 신규 | First controller in the usage module. `@Controller('usage')`. `GET /usage/dashboard` gated by `@UseGuards(JwtAuthGuard, RequirePermissionGuard)` + `@RequirePermission(Capability.MANAGE_WORKSPACE)`. Query params `month` (YYYY-MM, optional) and `days` (optional, default 30). Returns `DashboardResponse`. Controller only parses + delegates (clean-code rule). |
| `apps/server/ai-service/src/usage/usage.module.ts` | 수정 | Register `Message` + `Feedback` schemas via `MongooseModule.forFeature`; add `controllers: [UsageController]`; provide `DashboardService`. Ensure `PassportModule`/`SharedJwtStrategy` wiring so `JwtAuthGuard`+`RequirePermissionGuard` resolve (see B-note). |
| `apps/server/ai-service/src/usage/dashboard.service.spec.ts` | 신규 | Unit tests: cost math (cost-estimator), 👎-rate calc, top-users sort, empty-data, model-not-in-pricemap fallback. Mock Mongoose models. |
| `apps/server/ai-service/src/app.module.ts` | 수정 (확인) | Ensure `PassportModule` + `SharedJwtStrategy` are registered app-wide so the JWT guard works (TASK-14 likely already wired JWT for conversation-access — reuse it; verify before adding). |

**B-note (the one integration risk — resolve during impl):** ai-service has NOT used `@RequirePermission`/`RequirePermissionGuard` before. The shared `RequirePermissionGuard` (`packages/database/src/auth/require-permission.guard.ts`) reads `req.user.perms` from the JWT claim, which auth-service already issues (`JwtUser.perms`), and `JwtAuthGuard` (`jwt.guard.ts`, the `SharedJwtStrategy`) populates `req.user`. Action: (1) confirm `SharedJwtStrategy` is a registered provider + `PassportModule` imported in the module serving this controller — required for `JwtAuthGuard` to populate `req.user`; (2) import `{ JwtAuthGuard, RequirePermissionGuard, RequirePermission }` from the shared auth barrel and `{ Capability }` from the rbac barrel — verify the exact tsconfig path alias ai-service uses for `packages/database` (check an existing ai-service import of the shared package; `settings/workspace.schema.ts` references `@platform/database`). No new capability, no auth-service change.

---

### Web (Next.js — apps/web/)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/lib/api/axios.ts` | 수정 | Add a 4th instance `aiApi` (baseURL `process.env.NEXT_PUBLIC_AI_URL \|\| '/api/ai'`, port 3002) + attach the same `injectToken` request interceptor. (No `aiApi` exists today — the personal token-usage page currently calls chat-service `/api/usage/tokens` via `chatApi`; the new admin endpoint lives on ai-service so it needs its own instance.) |
| `apps/web/.env` / deploy env | 수정 | Add `NEXT_PUBLIC_AI_URL` pointing at ai-service. |
| `apps/web/lib/api/usage.ts` | 신규 | `usageService.getDashboard({ month?, days? })` → `aiApi.get<DashboardResponse>('/usage/dashboard', { params })`. |
| `apps/web/lib/api/types.ts` | 수정 | Add `DashboardResponse` + sub-types (exact shape from API Contract). Single source of truth. |
| `apps/web/app/(main)/admin/usage/page.tsx` | 신규 | `<RequireCap cap="MANAGE_WORKSPACE"><UsageDashboard /></RequireCap>`. |
| `apps/web/components/admin/usage-dashboard.tsx` | 신규 | TanStack Query (`useQuery(['admin-usage', month])` via `usageService.getDashboard`). Renders: 3 headline stat cards (this-month tokens, estimated cost, 👎 rate), the daily tokens bar chart (reuse the canvas/CSS-bar approach from `token-usage/page.tsx` — NO new charting dep), per-model cost table, top-users table, worst-rated-answers list. Month selector. Keep < 400 lines; extract `<TopUsersTable/>`, `<WorstAnswers/>`, `<PerModelCostTable/>` if it grows. |
| `apps/web/components/layout/AdminShell.tsx` | 수정 | Add `{ href: '/admin/usage', cap: 'MANAGE_WORKSPACE', labelKey: 'navUsage', icon: ... }` to `ADMIN_SECTIONS`. |
| `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` | 수정 (×7) | New keys under `admin.*` (`navUsage`) and a new `usageDashboard.*` group (title, headline labels, perModelCost, topUsers, worstAnswers, thumbsDownRate, month, noData, loadError). Reuse existing `tokenUsage.*` strings where identical (inputTokens/outputTokens/estimatedCost). |

**Charting decision:** No charting library is installed (`recharts`/`chart.js`/`visx` all ABSENT in `package.json`). The existing `/token-usage` page draws bars on a raw `<canvas>`. Reuse that approach (or simple CSS flex bars) — do **NOT** add a heavy dependency for one admin page.

---

### Mobile (Flutter — apps/client/)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/core/api/dio_client.dart` | 수정 | Add `createAiDio(...)` (ai-service base URL) — no AI Dio exists today (only auth/chat/connector). |
| `apps/client/lib/core/config/app_config.dart` | 수정 | Add `aiBaseUrl` (port 3002). |
| `apps/client/lib/features/admin/data/models/usage_dashboard_models.dart` | 신규 | Dart models mirroring `DashboardResponse` (headline totals, top-users, per-model cost, worst answers). |
| `apps/client/lib/features/admin/data/admin_repository.dart` (or new `usage_repository.dart`) | 수정/신규 | `getUsageDashboard({String? month})` via `aiDio.get('/usage/dashboard')`. |
| `apps/client/lib/features/admin/state/usage_dashboard_provider.dart` | 신규 | `AsyncNotifierProvider` loading the dashboard. |
| `apps/client/lib/features/admin/ui/widgets/usage_dashboard_panel.dart` | 신규 | **Minimal** read-only panel: headline numbers (this-month tokens, estimated cost, 👎 rate), top-5 users list, worst-5 answers list. **No charts** (web-primary; see D6). Neon theme, < 400 lines. |
| `apps/client/lib/features/admin/ui/admin_screen.dart` | 수정 | Add a Usage section gated by `MANAGE_WORKSPACE` (mirror how AI Settings was added; `Cap.manageWorkspace`). |
| `apps/client/lib/l10n/app_*.arb` (×7) | 수정 | Add the same keys as web (usageDashboard group). Run `flutter gen-l10n` (do NOT hand-edit generated files). |

---

### API Contract

**Endpoint:** `GET /usage/dashboard` (ai-service, port 3002)
**Auth:** `Authorization: Bearer <jwt>` → `JwtAuthGuard` + `RequirePermissionGuard` with `@RequirePermission(MANAGE_WORKSPACE)`. 401 if unauth; 403 `{ code: 'INSUFFICIENT_PERMISSION', required: 'MANAGE_WORKSPACE' }` if lacking cap.

**Query params:**
- `month` (string, optional) — `"YYYY-MM"`. If present, the window is that calendar month and `daily[]` covers its days. Defaults to current month.
- `days` (number, optional) — alternative rolling window (e.g. `30`); if both given, `month` wins. Default 30 when `month` absent.

**Response (`DashboardResponse`):**
```jsonc
{
  "range": { "from": "2026-06-01", "to": "2026-06-30", "label": "2026-06" },
  "totals": {
    "inputTokens": 1840000,
    "outputTokens": 642000,
    "totalTokens": 2482000,
    "requestCount": 1213,
    "estimatedCostUsd": 12.47          // sum of perModelCost[].costUsd
  },
  "daily": [                            // for the over-time chart (token_usage rollup)
    { "date": "2026-06-01", "inputTokens": 52000, "outputTokens": 18000, "totalTokens": 70000, "requestCount": 41 }
    // ... one entry per day in range (zero-filled gaps, like the existing /api/usage/tokens)
  ],
  "perModelCost": [                     // from messages.trace grouped by model (D5)
    {
      "model": "claude-opus-4-8",
      "inputTokens": 900000,
      "outputTokens": 380000,
      "requestCount": 210,
      "inputPricePerMTok": 15.0,        // resolved from price map (echoed for transparency)
      "outputPricePerMTok": 75.0,
      "costUsd": 42.0                   // round(2)
    }
    // ... one per distinct model seen in window; unknown models use default prices
  ],
  "topUsers": [                         // token_usage grouped by userId, desc, top N (default 10)
    { "userId": "665...", "displayName": "Alice", "totalTokens": 410000, "requestCount": 88, "estimatedCostUsd": 3.10 }
    // displayName resolved via users collection join (best-effort; falls back to userId)
  ],
  "feedback": {
    "up": 142,
    "down": 17,
    "total": 159,                       // rated messages with a non-cleared vote in window
    "thumbsDownRate": 0.1069,           // down / total (0..1); 0 when total==0
    "worstAnswers": [                   // most recent down-rated answers in window, limit 10
      {
        "messageId": "667...",
        "conversationId": "661...",
        "comment": "Wrong total, hallucinated the figure",  // may be null
        "answerPreview": "The total is $4,210 ...",          // first ~200 chars of messages.content
        "createdAt": "2026-06-21T08:14:00.000Z"
      }
    ]
  }
}
```

**Notes for implementers:**
- `daily[]` reuses the exact same per-day shape the existing `/api/usage/tokens` returns, so the web chart code is reusable as-is.
- `perModelCost[].costUsd = inputTokens/1e6 * inputPricePerMTok + outputTokens/1e6 * outputPricePerMTok`.
- `feedback` window filters `ai_feedback.createdAt` within range; `worstAnswers` joins `messages` by `messageId` (string `_id` → ObjectId) for `answerPreview`.
- `topUsers` and `totals.totalTokens`/`requestCount` come from `token_usage`; `perModelCost` (and `totals.estimatedCostUsd`) come from `messages.trace`. The two token totals can differ slightly (trace tokens are per-message; token_usage is a daily upsert that also counts non-trace usage) — so `totals.estimatedCostUsd` is defined as the sum of `perModelCost` (model-aware), while `totals.totalTokens` stays the authoritative volume figure. Document this in the response JSDoc.

---

### Data Model Changes

**No new collections. No schema writes.** All three sources already exist in shared Mongo `platform`:
- `token_usage` — written by ai-service today (`UsageService.recordUsage`). Read-only here.
- `messages` (+ `messages.trace.{model,inputTokens,outputTokens}`) — written by chat-service. ai-service adds a **read-only** `message.schema.ts`.
- `ai_feedback` — written by chat-service (`AiFeedbackService`, `POST /api/messages/{id}/feedback`). ai-service adds a **read-only** `feedback.schema.ts`. (Shape confirmed from `AiFeedback.java`: `messageId, conversationId, userId, rating('up'|'down'), comment, createdAt, updatedAt`; "none" deletes the doc so only up/down persist.)

**New config (env vars, `configuration.ts` `pricing` block):**
```
AI_PRICE_<MODEL>_IN   / AI_PRICE_<MODEL>_OUT    // USD per 1M tokens, per model
AI_PRICE_DEFAULT_IN   (default 3)
AI_PRICE_DEFAULT_OUT  (default 15)
```
Seed sensible defaults for the three router models (`claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-8`). Parser builds `{ [model]: { inputPerMTok, outputPerMTok } }`; unknown models fall back to the defaults. (Model id ↔ tier mapping confirmed from `configuration.ts` router block: simple=haiku-4-5, mid=sonnet-4-6, complex=opus-4-8.)

Index check (read perf): if the model-cost aggregation over `messages` is slow at scale, add an **explicit** secondary index on `{ senderId: 1, createdAt: 1 }` — but defer unless QA shows latency, and create it explicitly (project memory flags the auto-index-creation trap in prod).

---

### Implementation Order
1. **Backend (ai-service) first — blocks both clients.** Add `pricing` config → read-only `message`/`feedback` schemas → `cost-estimator.ts` (+unit test) → `dashboard.service.ts` → `usage.controller.ts` with the `MANAGE_WORKSPACE` gate → wire module + JWT/Permission guard (resolve B-note) → `pnpm build && pnpm test`. **Freeze the API Contract above before clients start.**
2. **Web + Mobile in parallel** (both depend only on the frozen contract):
   - Web: `aiApi` instance + `NEXT_PUBLIC_AI_URL` → `usage.ts` + types → `/admin/usage` page + dashboard component (reuse token-usage chart) → AdminShell section → i18n ×7. `pnpm build`.
   - Mobile: `aiDio` + `aiBaseUrl` → models + repo + provider → minimal `usage_dashboard_panel.dart` + admin section entry → ARB ×7 + `flutter gen-l10n`. `flutter analyze`.
3. **QA / sync-check:** verify both clients call the same `GET /usage/dashboard`, identical headline numbers, both gated by `MANAGE_WORKSPACE`, i18n keys present in all 7 locales on both platforms. Record the D6 web-primary deviation rationale in the QA report.

---

### Edge Cases
- **No data in window** → all zeros, empty arrays, `thumbsDownRate: 0` (never NaN/division-by-zero). Both clients render an empty state.
- **Model in `messages.trace` not in the price map** → use `AI_PRICE_DEFAULT_*`; still appears in `perModelCost` (cost never silently dropped).
- **`messages.trace` absent on older AI messages** → excluded from `perModelCost` (filter `trace` exists) but their tokens still count in `token_usage` totals; handled by defining `totals.estimatedCostUsd` as the per-model sum.
- **`ai_feedback` with `rating` cleared** → chat-service deletes the doc on "none", so only up/down rows exist; no special handling.
- **`displayName` lookup miss** in `topUsers` (deleted user / bot) → fall back to `userId`; exclude `AI_BOT_USER_ID` from topUsers.
- **Non-admin hits endpoint** → 403 `INSUFFICIENT_PERMISSION` (server gate is the real boundary; clients also hide the section via capability check).
- **Large `messages` scan** for a busy month → bound by date range; add the `{senderId,createdAt}` index only if QA flags latency.
- **`month` param malformed** → validate `^\d{4}-\d{2}$`; 400 on bad input, else fall back to `days`/current month.
- **JWT lacks `perms` claim** (pre-enterprise token) → `RequirePermissionGuard` denies (403) — correct, matches existing admin endpoints.
