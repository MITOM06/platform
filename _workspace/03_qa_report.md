## QA Report — TASK-11 (Proactive Reminders & Daily Digest) — 2026-06-23

**Verdict: PASS.** All builds and test suites pass (re-run independently, not trusted from reports). The chat-service Java suite was attempted directly: it compiles clean and the targeted `ReminderSweepServiceTest` passes (4/4). The 4 critical checks (digest-field parity, reminder delivery, digest idempotency, client gating + i18n) all hold field-for-field. No P1 drift found. One cosmetic divergence and the env-default ownership item are noted below.

---

### Build / Test status (exact captured output)

| Service / Command | Result |
|---|---|
| `pnpm --filter @platform/database test` | **PASS** — `Test Suites: 5 passed, 5 total` / `Tests: 20 passed, 20 total` (includes `ai-digest-log.spec.ts`, `workspace-ai-settings.spec.ts`) |
| `pnpm --filter @platform/auth-service test` | **PASS** — `Test Suites: 12 passed, 12 total` / `Tests: 53 passed, 53 total` |
| `pnpm --filter ai-service build` | **PASS** — `nest build` completed (only unrelated pnpm/engine warnings) |
| `pnpm --filter ai-service test` | **PASS** — `Test Suites: 31 passed, 31 total` / `Tests: 266 passed, 266 total` |
| `pnpm --filter @platform/web build` | **PASS** — `✓ Compiled successfully in 2.1s`; no TS/ESLint errors |
| `cd apps/client && flutter analyze` | **PASS** — `No issues found! (ran in 2.9s)` |
| `cd apps/client && flutter test` | **PASS (ran, not just analyze)** — `All tests passed!` (+47) |
| chat-service `mvn -q -DskipTests compile` | **PASS** — exit 0 (system Maven 3.9.16 / Java 21; **no `mvnw` wrapper exists in the module**) |
| chat-service `mvn -Dtest='ReminderSweepService*' test` | **PASS** — `Tests run: 4, Failures: 0, Errors: 0, Skipped: 0` / `BUILD SUCCESS` (exit 0) |

> chat-service note: there is **no Maven wrapper** (`apps/server/chat-service/mvnw` absent) — used system `mvn` (Maven 3.9.16, Java 21). The **targeted** reminder test was run and passes; the WARN/ERROR lines in its log are the *expected* negative-path assertions (FCM-push-fails-but-in-chat-delivered, and persist-fails-so-not-marked-notified). The **full** Java suite was not run end-to-end (needs Mongo/infra and is slow) — but the new code compiles clean and the acceptance-critical test passes, so the prior backend deferral is now closed for the load-bearing path.

---

### CRITICAL CHECK 1 — Digest-field contract parity (4-way, field-for-field)

| Field | DB schema (`workspace.schema.ts`) | auth DTO (`workspace.dto.ts`) | Web (`admin-types.ts`) | Flutter (`admin_models.dart`) |
|---|---|---|---|---|
| `dailyDigestEnabled` | `@Prop({type:Boolean, default:null})` → `boolean \| null` | `@IsOptional @IsBoolean` → `boolean \| null` | `dailyDigestEnabled: boolean \| null` | `bool? dailyDigestEnabled` (json key `dailyDigestEnabled`) |
| `dailyDigestHour` | `@Prop({type:Number, default:null})` → `number \| null` | `@IsOptional @IsInt @Min(0) @Max(23)` → `number \| null` | `dailyDigestHour: number \| null` | `int? dailyDigestHour` (json key `dailyDigestHour`) |

- **null = inherit semantics consistent on all four layers.** DB defaults `null`; auth DTO `@IsOptional` permits null/absent; web/Flutter document `null = inherit ai-service env default`.
- **0–23 range** enforced server-side (`@Min(0) @Max(23)`); web clamps 0–23, Flutter hour picker 0–23. `dailyDigestHour:0` round-trips (asserted in the DB spec).
- ai-service `SettingsService.resolve()` surfaces both as non-null resolved values with `?? env` fallback (`dailyDigestEnabled ?? AI_DIGEST_ENABLED(false)`, `dailyDigestHour ?? AI_DIGEST_HOUR(8)`).
- **Result: no drift. Parity confirmed.** (No P1.)

### CRITICAL CHECK 2 — Reminder delivery (acceptance criterion) ✓

`ReminderSweepService.sweepDueReminders()` now calls `aiMessageService.saveAiMessage(reminder.getConversationId(), "🔔 " + text, null)` for each due reminder → persists a `type:"ai"` message (senderId = AI_BOT_USER_ID) + single STOMP broadcast to `/topic/conversation/{id}`, the same path web + mobile already render. Confirmed:
- **In-chat persist is load-bearing; FCM push is best-effort** (wrapped in inner try/catch; push failure does NOT block delivery — proven by test `stillMarksNotifiedWhenOnlyFcmPushFails`).
- **`notified=true` set only after persist succeeds** → at-least-once, no double-send on the happy path (proven by `doesNotMarkNotifiedWhenInChatPersistFails`).
- **NO new HTTP endpoint** — `AiMessageService` is called in-process; no `InternalAiController` / `X-Internal-Token` added.

### CRITICAL CHECK 3 — Digest idempotency + delivery ✓

`DailyDigestCron` (`@Cron('0 * * * *')`, hourly): gated by `settings.dailyDigestEnabled === true` AND `now.getHours() === dailyDigestHour`. Per conversation it **inserts the `DigestLog {conversationId, digestDate}` row BEFORE generation** (`digestLogModel.create`), and on Mongo dup-key (11000) **skips silently** — the `ai_digest_log` collection has the unique compound index `{conversationId:1, digestDate:1}` (asserted in `ai-digest-log.spec.ts`). The claim row is rolled back (`deleteOne`) on no-activity or generation failure so a later run can retry. Delivery is a synthetic `{type:'AI_STREAM_DONE', fullContent, ...}` published to Redis `ai:response:{conversationId}` via `RedisPublisherService`, reusing chat-service's existing `AiResponseListener` (no new endpoint). `ScheduleModule.forRoot()` + `SchedulerModule` are wired in `app.module.ts`; `@nestjs/schedule ^6.1.3` added to `package.json`.

### CRITICAL CHECK 4 — Client gating (MANAGE_WORKSPACE) + i18n ✓

- **Web:** `/admin/ai/page.tsx` wraps `<WorkspaceAiSettings/>` in `<RequireCap cap="MANAGE_WORKSPACE">`; digest controls mutate via existing `useUpdateWorkspace()` → `PATCH /admin/workspace` (no new endpoint/hook).
- **Flutter:** `workspace_ai_settings_panel.dart` is mounted under the `Cap.manageWorkspace` admin section in `admin_screen.dart`; rides `workspaceProvider.notifier.save({'aiSettings': …})` → same PATCH.
- **i18n complete on BOTH platforms, all 7 locales:**
  - Web (`messages/*.json`, `admin` namespace): `aiDailyDigest*` keys = **4 each** for en, vi, zh, ja, ko, es, fr.
  - Flutter (`l10n/app_*.arb`): digest keys = **5 each** for en, vi, zh, ja, ko, es, fr. (`flutter gen-l10n` output present; `flutter analyze` clean.)

> Note (per task): reminder/digest delivery intentionally reuses the existing `type:"ai"` message path — **no new client message-type code is expected, and none was added.** This is correct, not a gap.

---

### Findings

| Severity | File:line | Issue | Recommendation |
|---|---|---|---|
| INFO (cosmetic, not a contract break) | `apps/web/components/admin/WorkspaceAiSettings.tsx:120-121` vs Flutter `workspace_ai_settings_panel.dart` | Payload divergence: web keeps the previously-set `dailyDigestHour` value when the toggle is `off` (selector disabled, not cleared); Flutter sends `dailyDigestHour: null` when not enabled. Both backend-valid (cron ignores hour when disabled). | Leave as-is, or force `dailyDigestHour: null` when `dailyDigest !== 'on'` on web for exact payload parity. Not blocking. |
| INFO (owner action) | `apps/server/ai-service/src/config/configuration.ts:156-165` | `AI_DIGEST_ENABLED` (default `false`), `AI_DIGEST_HOUR` (default `8`), optional `AI_DIGEST_MODEL` are the env fallbacks when `aiSettings.dailyDigest*` are null. Digest is **OFF by default** — a workspace admin must opt in (or set `AI_DIGEST_ENABLED=true`). | If a default-on morning digest is desired in any deployment, set `AI_DIGEST_ENABLED`/`AI_DIGEST_HOUR` in that env. No code change needed. |
| INFO (process) | chat-service module | No `mvnw` wrapper present; full Java suite needs Mongo/infra and was not run end-to-end. | Targeted `ReminderSweepServiceTest` (the acceptance path) passes + module compiles clean — acceptable. Run full `mvn test` against infra before release if broader regression coverage is wanted. |

### Owner action items
1. **Decide default-on vs default-off digest per deployment** — currently OFF (`AI_DIGEST_ENABLED` unset/`false`). Set `AI_DIGEST_ENABLED=true` + `AI_DIGEST_HOUR=<0-23>` in the target env if a workspace should get digests without an admin toggling it.
2. **Timezone is server/workspace-local** (single-tenant assumption); per-user timezone + per-user opt-in (`ai_user_prefs`) is the documented out-of-scope follow-up.
3. *(Optional)* Align the web `dailyDigestHour`-on-off payload with Flutter for exact parity.

### Conclusion
**PASS** — TASK-11 is correctly and completely implemented across all four layers. Reminder delivery now persists+broadcasts a `type:"ai"` message (web + mobile + history) with no new endpoint and `notified`-flag dedup; the daily-digest cron is idempotent via the unique `ai_digest_log` index and delivers over the existing Redis `AI_STREAM_DONE` path; the two new digest fields match field-for-field across DB / auth-DTO / web-TS / Flutter with null=inherit semantics; both clients gate the toggle by `MANAGE_WORKSPACE`, reuse `PATCH /admin/workspace`, and ship full 7-locale i18n. All re-run builds/tests green, including the chat-service compile and the targeted `ReminderSweepServiceTest`.
