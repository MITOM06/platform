# TASK-11 Backend Implementation Report — Proactive Reminders & Daily Digest

Implemented the **Backend** section of `_workspace/01_plan.md` across all four areas, in the plan's
order. Step 1 (shared DB) anchors the fixed contract; steps 2–4 build on it. No new HTTP endpoint was
added anywhere (per Decision 1, rejected option b). No backward-compat breaks.

---

## Area 1 — `packages/database` (contract anchor)

**What I built**
- Extended `WorkspaceAiSettings` with the two nullable digest fields (`null` = inherit env).
- Added a new `ai_digest_log` schema/collection with the UNIQUE idempotency index.
- Exported the new schema; ran the package tests.

**Files changed**
- `packages/database/src/mongo/workspace.schema.ts` — added `dailyDigestEnabled: boolean | null`
  (`@Prop({ type: Boolean, default: null })`) and `dailyDigestHour: number | null`
  (`@Prop({ type: Number, default: null })`).
- `packages/database/src/mongo/ai-digest-log.schema.ts` — **new.** `@NestSchema({ collection:
  'ai_digest_log' })` with `{ conversationId: string, digestDate: string, createdAt: Date }` and a
  **unique** compound index `{ conversationId: 1, digestDate: 1 }`.
- `packages/database/src/index.ts` — exported `./mongo/ai-digest-log.schema`.
- `packages/database/src/mongo/__tests__/workspace-ai-settings.spec.ts` — asserts the new fields
  default to `null`, round-trip when populated, and preserve `dailyDigestHour: 0`.
- `packages/database/src/mongo/__tests__/ai-digest-log.spec.ts` — **new.** Asserts the unique
  `{conversationId, digestDate}` index, the collection name, and required fields.

**Exact `aiSettings` additions (clients/QA must match)**
```ts
dailyDigestEnabled?: boolean | null  // null ⇒ inherit env AI_DIGEST_ENABLED (default false)
dailyDigestHour?:    number | null   // 0..23 local hour; null ⇒ inherit env AI_DIGEST_HOUR (default 8)
```

---

## Area 2 — chat-service (Java/Spring Boot) — the acceptance-critical delivery fix

**What I built**
- `ReminderSweepService` now injects `AiMessageService` and, for each fired reminder, calls
  `aiMessageService.saveAiMessage(conversationId, "🔔 " + text, null)` — persisting the reminder as a
  real `type:"ai"` message (`senderId = AI_BOT_USER_ID`) with the single STOMP broadcast to
  `/topic/conversation/{id}`, exactly like AI answers / meeting-summary cards. Web (no FCM) now
  receives reminders; history records them.
- The existing FCM push is **kept** as a best-effort out-of-app nudge for mobile, wrapped so a push
  failure does NOT block the in-chat delivery.
- Idempotency: `notified=true` is set only **after** the in-chat persist succeeds → at-least-once
  across restarts (reuses the existing `notified` flag + `due_sweep` index; no double-send).
- **No new HTTP endpoint.** `AiMessageService` and `application.yml` were referenced, not changed.

**Files changed**
- `apps/server/chat-service/.../service/ReminderSweepService.java` — injected `AiMessageService`;
  added the in-chat persist + `formatReminderText()` helper (`REMINDER_PREFIX = "🔔 "`); reordered so
  persist is load-bearing and push is best-effort.
- `apps/server/chat-service/.../service/ReminderSweepServiceTest.java` — **new.** 4 tests:
  text-prefix formatting, persist+push+notified happy path, *no* `notified` when persist throws
  (retry), and `notified` still set when only the FCM push fails.

**Reminder STOMP frame (delivered via the standard `MessageResponse`)**
```json
{ "id": "...", "conversationId": "...", "senderId": "ai-bot-000000000000000000000001",
  "type": "ai", "content": "🔔 <reminder text>", "trace": null, "createdAt": "ISO-8601",
  "readBy": [], "reactions": [] }
```

---

## Area 3 — auth-service (workspace opt-in fields)

**What I built**
- Extended `WorkspaceAiSettingsDto` with the two digest fields + validation (`@IsBoolean`,
  `@IsInt @Min(0) @Max(23)`, both `@IsOptional`). The existing dot-path `$set` deep-merge +
  `ai:settings:invalidate` Redis bust (TASK-12) cover them automatically — no service change needed.
- Change is in the `admin` module (not the locked `auth` module; also allowed by `auth-guard.md`).

**Files changed**
- `apps/server/auth-service/src/modules/admin/dto/workspace.dto.ts` — added `Max` import +
  `dailyDigestEnabled?: boolean | null` and `dailyDigestHour?: number | null` (0–23) to
  `WorkspaceAiSettingsDto`.
- `apps/server/auth-service/src/modules/admin/admin.service.spec.ts` — added a test proving the
  digest fields deep-merge via dot-path `$set` (`aiSettings.dailyDigestEnabled` /
  `aiSettings.dailyDigestHour`) without wiping siblings.

**Endpoint (unchanged, extended payload):** `PATCH /api/admin/workspace` (`MANAGE_WORKSPACE`) accepts
`{ aiSettings: { dailyDigestEnabled?, dailyDigestHour? } }`; side-effect publishes
`ai:settings:invalidate`.

---

## Area 4 — ai-service (daily-digest scheduler — first `@nestjs/schedule` usage)

**What I built**
- Added `@nestjs/schedule` (^6.1.3) and registered `ScheduleModule.forRoot()` once in `AppModule`.
- New `SchedulerModule` wiring the cron + generator + `ai_digest_log` model (imports `SettingsModule`,
  `RedisModule`, `MongooseModule.forFeature([DigestLog])`).
- `DailyDigestCron` `@Cron('0 * * * *')` (hourly): reads the cached `SettingsService.getSettings()`;
  returns unless `dailyDigestEnabled === true` AND `now.getHours() === dailyDigestHour`; finds
  conversations active yesterday (`messages.distinct('conversationId', …)`); for each, inserts the
  `DigestLog {conversationId, digestDate=yesterday}` row **first** (unique index = idempotency), then
  generates + delivers. Per-conversation try/catch; never throws out of the tick.
- `DigestGeneratorService` reads yesterday's `text`/`ai`, non-recalled messages from the shared
  `messages` collection (`connection.collection('messages')`, mirroring `SearchMessagesTool`), renders
  a `Name: text` transcript, calls Anthropic non-streaming `messages.create` (mirroring
  `CallSummaryService.generateSummary()`, **fast tier** by default), and delivers by publishing a
  synthetic `AI_STREAM_DONE` to `ai:response:{conversationId}` (the existing chat-service
  `AiResponseListener` persists + broadcasts it as a `type:"ai"` message).
- Extended `SettingsService.resolve()` / `ResolvedAiSettings` to surface `dailyDigestEnabled` /
  `dailyDigestHour` (null ⇒ env). Added digest env defaults to `configuration.ts`.

**Files changed / added**
- `apps/server/ai-service/package.json` — added `@nestjs/schedule` (`^6.1.3`).
- `apps/server/ai-service/src/app.module.ts` — `ScheduleModule.forRoot()` + `SchedulerModule` imports.
- `apps/server/ai-service/src/scheduler/scheduler.module.ts` — **new** wiring module.
- `apps/server/ai-service/src/scheduler/daily-digest.cron.ts` — **new** hourly cron + idempotency.
- `apps/server/ai-service/src/scheduler/digest-generator.service.ts` — **new** transcript + summary +
  Redis delivery.
- `apps/server/ai-service/src/scheduler/digest-log.schema.ts` — **new** local `ai_digest_log` model
  with the unique `{conversationId, digestDate}` index.
- `apps/server/ai-service/src/scheduler/digest-date.util.ts` — **new** pure local-day/yesterday-window
  helpers (testable idempotency-key math).
- `apps/server/ai-service/src/config/configuration.ts` — added `digest: { enabled, hour, model }`.
- `apps/server/ai-service/src/settings/settings.service.ts` — resolve the 2 digest fields (null ⇒ env).
- `apps/server/ai-service/src/settings/resolved-ai-settings.ts` — `dailyDigestEnabled`/`Hour` on the
  interface.
- `apps/server/ai-service/src/settings/workspace.schema.ts` — added the 2 fields to the projection.
- **Tests (new):** `scheduler/digest-date.util.spec.ts` (window/boundary math),
  `scheduler/daily-digest.cron.spec.ts` (disabled → noop, wrong-hour → noop, claim+generate per conv,
  **duplicate-key → skip generation**, no-activity → rollback, generation-throws → rollback).
- **Tests (updated):** `settings/settings.service.spec.ts` and `ai/ai.service.spec.ts` fixtures for the
  2 new resolved fields.

**Digest message shape (ai-service → Redis → chat-service)** — channel `ai:response:{conversationId}`:
```json
{ "type": "AI_STREAM_DONE", "fullContent": "<digest text>", "sources": [], "trace": null,
  "conversationId": "<id>" }
```
chat-service `AiResponseListener` → `saveAiMessage` → the identical `type:"ai"` `MessageResponse` as a
reminder (digest body is plain markdown, not a JSON card).

---

## Idempotency mechanisms

- **Reminders:** existing `Reminder.notified` boolean + `due_sweep` index. `notified=true` set only
  after the in-chat persist succeeds → at-least-once; a crash mid-sweep re-delivers at most the
  in-flight item next tick.
- **Daily digest:** unique index `{conversationId, digestDate}` on `ai_digest_log`. The cron inserts
  the row **before** generating; a duplicate-key (redeploy mid-run, racing instances) → skip. The row
  is **rolled back** (`deleteOne`) if there was no activity yesterday or generation threw, so a later
  run can retry. `digestDate` = `YYYY-MM-DD` of the summarized day (yesterday), local time.

## Env / dependency additions

- ai-service dep: **`@nestjs/schedule` ^6.1.3** (first scheduler in the service).
- ai-service env fallbacks (used when `aiSettings.dailyDigest*` are null):
  - `AI_DIGEST_ENABLED` (default `false`)
  - `AI_DIGEST_HOUR` (default `8`, 0–23 local)
  - `AI_DIGEST_MODEL` (optional; else fast router tier via `modelTier`)

---

## Build / test results (exact)

| Command | Result |
|---|---|
| `pnpm --filter @platform/database test` | **PASS** — Test Suites: 5 passed; Tests: **20 passed** |
| `pnpm --filter @platform/database build` (tsc) | **PASS** |
| chat-service `mvn -q compile` | **PASS** (exit 0) |
| chat-service `mvn test -Dtest=ReminderSweepServiceTest` | **PASS** — Tests run: **4**, Failures: 0, Errors: 0; BUILD SUCCESS |
| `pnpm --filter @platform/auth-service test` | **PASS** — Test Suites: 12 passed; Tests: **53 passed** |
| `pnpm --filter @platform/auth-service build` (nest) | **PASS** |
| `pnpm --filter ai-service build` (nest) | **PASS** |
| `pnpm --filter ai-service test` | **PASS** — Test Suites: **31 passed**; Tests: **266 passed** |

(Note: `mvn spotless:apply` was run once to satisfy the chat-service Google-Java-Format gate before the
chat-service tests; that is a formatting step, not a code change.)

---

## Deferrals / notes

- **Full chat-service test suite** was not run end-to-end (slow + needs infra); the targeted
  `ReminderSweepServiceTest` passes and `mvn compile` is clean. There is no `@SpringBootTest` context
  test referencing `ReminderSweepService`, so the new constructor arg auto-wires safely.
- **Digest model tier:** defaults to the FAST router tier (`simpleModel`) for `auto`/`simple`;
  `mid`/`complex` honor the workspace `modelTier`; `AI_DIGEST_MODEL` overrides all. Per plan Decision 4.
- **Timezone:** single-tenant ⇒ server/workspace local hour (per-user tz is the documented follow-up).
  Hourly cron = 1-hour granularity (intentional).
- **Client work (Flutter + Web admin toggle, i18n ×7, render-only verification)** is the Mobile/Web
  section of the plan — out of scope for this backend pass.
- **Per-user opt-in** (`ai_user_prefs`) is the noted follow-up; this task ships the workspace-level
  toggle only.
