## Feature: TASK-11 — Proactive reminders & daily digest

### Summary
The `create_reminder` tool + `reminders` collection already exist, and chat-service already runs a `@Scheduled` `ReminderSweepService` that fires due reminders — **but only as an FCM push**, never as a persisted, in-conversation message (so web, which has no FCM, never sees them, and there is no chat-history record). TASK-11 closes the real gap: a fired reminder must become a **real, persisted assistant message broadcast over STOMP** so both web + mobile render it via the existing message pipeline with zero new client message-type handling. We achieve this by enhancing the existing chat-service sweep to also inject the reminder as a `type:"ai"` message (reusing `AiMessageService`), and we add a **new ai-service daily-digest cron** (the first `@nestjs/schedule` usage in the service) that summarizes the prior day per active AI conversation and delivers it the same way — gated by a new **workspace-level** `aiSettings.dailyDigest*` opt-in (reusing the fully-built TASK-12 settings infra).

---

### KEY DECISIONS (resolved)

**Decision 1 — Delivery mechanism: how a fired reminder/digest becomes a persisted message on both clients.**
- **Resolved:** Deliver as a normal **`type:"ai"`** message persisted + broadcast by chat-service's existing `AiMessageService.saveAiMessage(conversationId, content, trace=null)`. This is the SAME method that persists every AI answer and the meeting-summary card; it writes the `messages` doc (`senderId = AI_BOT_USER_ID`, `type:"ai"`) and does the single STOMP broadcast to `/topic/conversation/{id}`. Web (`MessageBubble.tsx` `case 'ai'`) and Flutter (`message_bubble.dart`) already render `type:"ai"` with AI avatar/styling. **Zero client message-type work** for delivery.
- **Rejected (a) — synthetic `AI_STREAM_DONE` over Redis `ai:response:{id}` for reminders:** technically works (chat-service's `AiResponseListener` would persist it), but it fakes a streaming lifecycle for a fixed string and **races the channel** if a real AI stream is in flight on the same conversation. So reminders use the in-process call instead.
- **Rejected (b) — a brand-new internal `POST /internal/messages/ai` endpoint:** an earlier investigation that claimed this endpoint already exists was **wrong** — verified there is NO `InternalAiController` and NO `X-Internal-Token` in chat-service today. Building one is unnecessary: the sweep is already inside chat-service and can call `AiMessageService` directly in-process.
- **Net:** **reminders →** in-process `AiMessageService.saveAiMessage()` call inside the existing chat-service sweep (no Redis, no HTTP). **Digest →** ai-service publishes a synthetic `AI_STREAM_DONE` to Redis `ai:response:{id}` (chat-service `AiResponseListener` already persists+broadcasts `AI_STREAM_DONE` via `saveAiMessage`), which is safe because a scheduled digest never coincides with a live user-triggered stream on that conversation. **No new chat-service HTTP endpoint is added anywhere.**

**Decision 2 — Idempotent firing across restarts.**
- **Reminders:** reuse the existing `Reminder.notified` boolean + the `due_sweep` compound index `{done:1, notified:1, remindAt:1}`. The sweep query `findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(now)` returns only un-fired due reminders; `notified=true` is set **after** successful in-chat persist, so a crash mid-sweep re-delivers at most the in-flight item next tick (at-least-once; acceptable). Cadence stays `@Scheduled(fixedDelayString="${app.reminder.sweep-interval-ms:60000}")` (60s).
- **Daily digest:** new `ai_digest_log` collection with a **unique index** on `{conversationId, digestDate}` (`digestDate` = `YYYY-MM-DD` of the summarized day). The cron inserts the log row **first** (`insertOne`; duplicate-key = already done → skip) before generating, so a restart/redeploy mid-run never double-posts. Cadence: `@Cron('0 * * * *')` (hourly); each tick processes only conversations whose configured `dailyDigestHour` matches the current local hour AND lack a log row for "yesterday".

**Decision 3 — Where the daily-digest opt-in lives + client toggle.**
- **Resolved: workspace-level**, as new nullable fields on the existing `WorkspaceAiSettings` sub-doc: `dailyDigestEnabled: boolean|null` and `dailyDigestHour: number|null` (0–23 local hour to deliver). **Justification:** (1) there is **no per-user preferences store** anywhere (verified: no `user_preferences` collection, no `User.settings` field) — per-user opt-in would require net-new storage + a net-new non-admin settings surface on both clients; (2) PON is single-tenant-per-deployment, so a workspace toggle = "this company wants morning digests" is a coherent unit; (3) the TASK-12 `aiSettings` path is **fully built end-to-end** (schema nullable-inherit, auth `PATCH /admin/workspace` DTO + `MANAGE_WORKSPACE` guard + `ai:settings:invalidate` Redis bust, ai-service cached `SettingsService`, web `WorkspaceAiSettings.tsx`, Flutter `workspace_ai_settings_panel.dart`) — we extend it with two fields and reuse everything.
- **Client toggle (the real client work):** add a "Daily digest" switch + hour picker to the existing admin AI settings panels (`WorkspaceAiSettings.tsx` + `workspace_ai_settings_panel.dart`), gated by `MANAGE_WORKSPACE` like the other 7 fields. Per `sync.md` + `i18n.md`: add keys to all 7 web locales and all 7 Flutter ARBs.
- **Follow-up (out of scope, noted):** true per-user opt-in + per-user digest hour requires a new `ai_user_prefs` collection + a user-facing toggle in the normal settings screen on both clients.

**Decision 4 — Digest generation (which summary/LLM path to reuse).**
- **Resolved:** mirror `CallSummaryService.generateSummary()` (ai-service) — a non-streaming `anthropic.messages.create({ model, max_tokens, system, messages })` call returning structured text. Use the **fast/cheap model tier** (resolved via `SettingsService` `modelTier` → model router, defaulting to the configured fast model) to control cost. Source messages: ai-service does **not** own a `messages` Mongoose model, but `SearchMessagesTool` already reads the shared collection via `connection.collection('messages')`; the digest service reads the same way: `{ conversationId, createdAt: {$gte: startOfYesterday, $lt: startOfToday}, type: {$in:['text','ai']}, recalled:{$ne:true} }`, renders a transcript, summarizes, and delivers via Decision 1's Redis `AI_STREAM_DONE` path.

---

### Backend (Spring Boot chat-service + NestJS ai-service + NestJS auth-service + shared DB)

#### chat-service (reminder delivery — the acceptance-critical path)
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ReminderSweepService.java` | 수정 | In the sweep loop, also call `aiMessageService.saveAiMessage(reminder.getConversationId(), formatReminderText(reminder.getText()), null)` to persist+broadcast the reminder as an in-chat `type:"ai"` message. Inject `AiMessageService`. Keep FCM push (mobile out-of-app) AND in-chat message (web + history). Only set `notified=true` after the in-chat persist succeeds (persist is load-bearing; push is best-effort). Prefix text e.g. `"🔔 " + reminder.getText()`. |
| `apps/server/chat-service/src/main/java/com/platform/chatservice/service/AiMessageService.java` | 참조(무변경) | Reuse existing `saveAiMessage(...)` — already persists `type:"ai"` + single STOMP broadcast. No change. |
| `apps/server/chat-service/src/main/resources/application.yml` | 참조(무변경) | `app.reminder.sweep-interval-ms` already configured (60000 default). |

#### ai-service (daily digest scheduler — new) — files ≤300 lines each per ai-service rules
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/server/ai-service/package.json` | 수정 | Add `@nestjs/schedule` (`pnpm --filter ai-service add @nestjs/schedule`). First scheduler in the service. |
| `apps/server/ai-service/src/app.module.ts` | 수정 | `ScheduleModule.forRoot()` to imports; import new `SchedulerModule`. |
| `apps/server/ai-service/src/scheduler/scheduler.module.ts` | 신규 | Wiring: imports `SettingsModule`, `RedisModule`, `MongooseModule.forFeature([{name: DigestLog.name, schema: DigestLogSchema}])`; provides `DailyDigestCron`, `DigestGeneratorService`. |
| `apps/server/ai-service/src/scheduler/daily-digest.cron.ts` | 신규 | `@Cron('0 * * * *')` hourly. Read `SettingsService.getSettings()`; if `dailyDigestEnabled !== true` → return. For conversations whose `dailyDigestHour` == current local hour, attempt idempotent `DigestLog` insert ({conversationId, digestDate=yesterday}); on success call `DigestGeneratorService.generateAndDeliver(conversationId)`. try/catch per conversation; never throw. |
| `apps/server/ai-service/src/scheduler/digest-generator.service.ts` | 신규 | Read yesterday's messages from shared `messages` collection (`connection.collection('messages')`, mirroring `SearchMessagesTool`), build transcript, call Anthropic `messages.create` (fast tier via `SettingsService.modelTier`), then deliver by publishing `{type:'AI_STREAM_DONE', fullContent: digestText, sources: [], trace: null, conversationId}` via `RedisPublisherService.publish(conversationId, payload)`. |
| `apps/server/ai-service/src/scheduler/digest-log.schema.ts` | 신규 | `@Schema({collection:'ai_digest_log'})` — `{conversationId: string, digestDate: string (YYYY-MM-DD), createdAt: Date}` with **unique compound index** `{conversationId:1, digestDate:1}`. |
| `apps/server/ai-service/src/config/configuration.ts` | 수정 | Add digest env defaults: `AI_DIGEST_ENABLED` (default false), `AI_DIGEST_HOUR` (default 8), optional `AI_DIGEST_MODEL`. These are the env fallbacks when `aiSettings.dailyDigest*` is null. |
| `apps/server/ai-service/src/settings/settings.service.ts` | 수정 | Extend `ResolvedAiSettings` + `resolve()` to surface `dailyDigestEnabled` / `dailyDigestHour` (null → env `AI_DIGEST_ENABLED`/`AI_DIGEST_HOUR`). |

#### shared DB + auth-service (workspace opt-in field)
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `packages/database/src/mongo/workspace.schema.ts` | 수정 | Add to `WorkspaceAiSettings`: `@Prop({type:Boolean, default:null}) dailyDigestEnabled: boolean|null;` and `@Prop({type:Number, default:null}) dailyDigestHour: number|null;` (null = inherit env). |
| `apps/server/auth-service/src/modules/admin/dto/workspace.dto.ts` | 수정 | Add to `WorkspaceAiSettingsDto`: `@IsOptional() @IsBoolean() dailyDigestEnabled?: boolean|null;` and `@IsOptional() @IsInt() @Min(0) @Max(23) dailyDigestHour?: number|null;`. Existing dot-path `$set` deep-merge + `ai:settings:invalidate` publish already cover them. |

> auth-service change is to the `admin` module DTO (allowed — `admin` is not the locked `auth` module; auth-guard.md also grants full access).

---

### Mobile (Flutter)
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/admin/ui/widgets/workspace_ai_settings_panel.dart` (and/or `ai_settings_controls.dart`) | 수정 | Add a "Daily digest" `Switch` + hour picker (0–23) bound to `aiSettings.dailyDigestEnabled` / `dailyDigestHour`, gated by `MANAGE_WORKSPACE`. Rides existing `GET/PATCH /admin/workspace`. |
| `apps/client/lib/features/admin/data/models/admin_models.dart` | 수정 | Add `dailyDigestEnabled` (bool?) + `dailyDigestHour` (int?) to the workspace aiSettings model + JSON (de)serialization. |
| `apps/client/lib/features/chat/ui/widgets/message_bubble.dart` | 검증만 | Reminder/digest arrives as `type:"ai"` → already rendered. **Verification only**. |
| `apps/client/lib/l10n/app_en.arb` + 6 others (`vi, zh, ja, ko, es, fr`) | 수정 | Add keys: `aiDailyDigest`, `aiDailyDigestDesc`, `aiDailyDigestHour`. Run `flutter gen-l10n`. |

### Web (Next.js)
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/components/admin/WorkspaceAiSettings.tsx` | 수정 | Add "Daily digest" switch + hour `Select`/number input bound to `aiSettings.dailyDigestEnabled` / `dailyDigestHour`, gated by `MANAGE_WORKSPACE`. Same `PATCH /admin/workspace` mutation. |
| `apps/web/lib/api/types.ts` | 수정 | Add `dailyDigestEnabled?: boolean | null` + `dailyDigestHour?: number | null` to the workspace `aiSettings` type. |
| `apps/web/components/chat/MessageBubble.tsx` | 검증만 | `case 'ai'` already renders reminder/digest. **Verification only.** |
| `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` | 수정 | Add the 3 digest i18n keys (mirror Flutter keys). |

---

### API Contract (fixed)

**1. Reminder delivery (in-process, chat-service) — no HTTP.**
Sweep persists+broadcasts via `AiMessageService.saveAiMessage`. STOMP frame on `/topic/conversation/{id}` is the standard `MessageResponse`:
```
{
  id: string,
  conversationId: string,
  senderId: "ai-bot-000000000000000000000001",  // AI_BOT_USER_ID
  type: "ai",
  content: string,        // "🔔 <reminder text>"
  trace: null,
  createdAt: ISO-8601,
  readBy: [], reactions: [], ...
}
```

**2. Digest delivery (ai-service → Redis → chat-service).**
ai-service publishes to channel `ai:response:{conversationId}`:
```
{ type: "AI_STREAM_DONE", fullContent: "<digest text>", sources: [], trace: null, conversationId: "<id>" }
```
chat-service `AiResponseListener` (existing) → `AiMessageService.saveAiMessage` → identical `type:"ai"` `MessageResponse` broadcast as in (1).

**3. Workspace settings (existing endpoint, extended payload).**
`PATCH /api/admin/workspace` (auth-service, `MANAGE_WORKSPACE`):
- Request (partial): `{ aiSettings: { dailyDigestEnabled?: boolean|null, dailyDigestHour?: number|null /* 0..23 */ } }`
- Response: updated `Workspace` doc including `aiSettings` with the two new fields.
- Side effect: publishes Redis `ai:settings:invalidate` → ai-service `SettingsService` cache bust (≤60s TTL safety net).

---

### Data Model Changes
- `WorkspaceAiSettings` sub-doc (`packages/database` `workspace.schema.ts`): **+2 nullable fields** `dailyDigestEnabled`, `dailyDigestHour`. Backward compatible (null = inherit env). No migration (existing docs read as null → env default).
- New collection **`ai_digest_log`** (ai-service): `{conversationId, digestDate, createdAt}` with unique `{conversationId:1, digestDate:1}` index for idempotency.
- `reminders` collection + `Reminder` doc: **no change** (reuse `notified`/`done`/`remindAt` + `due_sweep` index).
- `messages` collection: **no schema change** — reminder/digest reuse the existing `type:"ai"` shape.

---

### Implementation Order
1. **Backend — shared DB + auth-service first (contract anchor):** add the two `aiSettings` fields to `workspace.schema.ts` + `workspace.dto.ts`. (`@platform/database` build, auth-service build/test.) Unblocks both clients in parallel.
2. **Backend — chat-service reminder injection (acceptance-critical):** enhance `ReminderSweepService` to call `AiMessageService.saveAiMessage`. `mvn compile && mvn test`. This alone satisfies the acceptance criterion.
3. **Backend — ai-service digest scheduler:** add `@nestjs/schedule`, `ScheduleModule.forRoot()`, the `scheduler` module (cron + generator + digest-log schema), extend `SettingsService` + `configuration.ts`. `pnpm build && pnpm test`.
4. **Mobile + Web (parallel, after step 1):** add the digest toggle + hour picker to the admin AI settings panel; extend the workspace aiSettings type/model; add the 3 i18n keys ×7 each. Verify reminder/digest renders as `type:"ai"` (no message-type code change).

Steps 2, 3, and the step-4 client pair are independent once step 1 lands → can run as parallel agents.

---

### Edge Cases
- **Reminder for a conversation the user left / deleted:** `saveAiMessage` still persists+broadcasts; `conversationRepository.findById` no-ops the lastMessage bump if the conv is gone. Acceptable; optionally skip if conversation missing (low priority).
- **Crash mid-sweep (reminder):** `notified=true` only after successful in-chat persist → at-least-once; a rare duplicate reminder message on restart is tolerable.
- **Digest double-post on redeploy:** prevented by inserting the unique `ai_digest_log` row BEFORE generating; duplicate-key → skip.
- **Digest with no activity yesterday:** generator finds 0 messages → skip generation (don't post an empty digest), don't write a log row.
- **Timezone for `dailyDigestHour`:** single-tenant deployment → use server/workspace local hour (document the assumption; per-user tz is the follow-up). Hourly cron = 1-hour granularity, intentional.
- **Settings cache staleness:** toggling digest off in admin publishes `ai:settings:invalidate`; worst case the next hourly tick within 60s TTL still honors it. Fine for a daily job.
- **Reminder fires while a live AI stream is running on the same conversation:** reminders use the in-process `saveAiMessage` path (NOT the Redis stream), so no collision with an in-flight `AI_STREAM_*` sequence.
- **FCM disabled / web-only user:** in-chat message is now the primary delivery (FCM best-effort), so web users finally receive reminders — the core gap this task closes.
- **i18n:** reminder/digest message bodies are model/text content (not UI chrome) → no UI i18n for the message itself; only the admin toggle labels need the 3 keys ×7 ×2 platforms.
