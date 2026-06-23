## QA Report — TASK-13 Usage & Quality Dashboard — 2026-06-23

Verdict: **PASS** (with one P3 type-drift to fix opportunistically + one owner-action for real cost numbers).

All four reports cross-checked against the code actually on disk. Note: the web and mobile
reports both claim `_workspace/02_backend_report.md` was a stale TASK-12 file at the time they
ran; the file on disk now is the correct TASK-13 backend report, and the implemented
`dashboard.types.ts` matches the plan's frozen contract — so the parallel client work landed on
the right shape regardless. Verified by reading the real files, not the reports.

---

### Build & Test status (exact, run by QA — not trusted from reports)

| Check | Command | Result |
|-------|---------|--------|
| ai-service build | `pnpm --filter ai-service build` | **PASS** — `nest build`, exit 0, no errors |
| ai-service test | `pnpm --filter ai-service test` | **PASS** — `Test Suites: 29 passed, 29 total` / `Tests: 255 passed, 255 total` (6.871 s) |
| web build | `pnpm --filter @platform/web build` | **PASS** — exit 0; `/admin/usage` confirmed compiled at `.next/server/app/(main)/admin/usage` |
| flutter analyze | `cd apps/client && flutter analyze` | **PASS** — `No issues found! (ran in 3.7s)` |
| flutter test | `cd apps/client && flutter test` | **PASS** — `All tests passed!` (47 tests) — **ran explicitly, not just analyze** |

Both Flutter `analyze` AND `test` were run (the prior stale-test footgun was avoided). No new
test was added for the read-only mobile mirror; logic lives in defensively-parsed models.

---

### Contract parity — `GET /usage/dashboard` (highest-risk check)

Source of truth: ai-service `src/usage/dashboard.types.ts` (frozen). Compared field-for-field
against web `lib/api/types.ts` `DashboardResponse` and Flutter
`features/admin/data/models/usage_dashboard_models.dart` `UsageDashboard`.

| Top-level field | Backend type | Web (`DashboardResponse`) | Flutter (`UsageDashboard`) | Match |
|---|---|---|---|---|
| `range {from,to,label}` | `string,string,string` | `UsageRange` same | `UsageRange` (`String?` x3) | ✓ |
| `totals.inputTokens` | number | number | int | ✓ |
| `totals.outputTokens` | number | number | int | ✓ |
| `totals.totalTokens` | number | number | int | ✓ |
| `totals.requestCount` | number | number | int | ✓ |
| `totals.estimatedCostUsd` | number | number | double | ✓ |
| `daily[] {date,inputTokens,outputTokens,totalTokens,requestCount}` | `DailyUsage[]` | `UsageDailyPoint[]` (drives chart) | **absent (intentional)** | ✓* |
| `perModelCost[].model` | string | string | `String` | ✓ |
| `perModelCost[].inputTokens/outputTokens/requestCount` | number x3 | number x3 | int x3 | ✓ |
| `perModelCost[].inputPricePerMTok/outputPricePerMTok` | number x2 | number x2 | double x2 | ✓ |
| `perModelCost[].costUsd` | number | number | double | ✓ |
| `topUsers[].userId` | string | string | `String` | ✓ |
| `topUsers[].displayName` | string | string | `String?` | ✓ (see note) |
| `topUsers[].totalTokens/requestCount` | number x2 | number x2 | int x2 | ✓ |
| **`topUsers[].estimatedCostUsd` (pro-rated)** | number | number | double | ✓ — present in all three; pro-rated semantics handled backend-side |
| `feedback.up/down/total` | number x3 | number x3 | int x3 | ✓ |
| `feedback.thumbsDownRate` | number (0..1) | number | double | ✓ |
| `feedback.worstAnswers[].messageId/conversationId` | string x2 | string x2 | `String` / `String?` | ✓ |
| `feedback.worstAnswers[].comment` | `string \| null` | `string \| null` | `String?` | ✓ |
| `feedback.worstAnswers[].answerPreview` | string | string | `String?` | ✓ |
| `feedback.worstAnswers[].createdAt` | **`string \| null`** | **`string` (non-null)** | `String?` | ⚠ P3 drift |

`*` **`daily` absent in Flutter is intentional, NOT drift.** Per plan D6 the mobile mirror omits
charts; it simply doesn't parse a field it never renders, and the Dart parser ignores extra
JSON keys. The pro-rated `topUsers[].estimatedCostUsd` (the field flagged as highest-risk) is
present and correctly typed in all three layers; the backend documents it as a token-volume
pro-rated share (not exact), which both clients render verbatim — acceptable.

---

### Gating (auth boundary)

| Layer | Mechanism | Verified |
|-------|-----------|----------|
| Backend | `@UseGuards(JwtAuthGuard, RequirePermissionGuard)` on `@Controller('usage')` + `@RequirePermission(Capability.MANAGE_WORKSPACE)` on `GET /dashboard` | ✓ `usage.controller.ts` L19/L24-25; imports from `@platform/database` |
| Backend wiring | `PassportModule` + `SharedJwtStrategy` registered app-wide (first ai-service controller to use these guards) | ✓ per backend report; build+tests pass |
| → 401 unauth / 403 without cap | `RequirePermissionGuard` reads JWT `perms` claim | ✓ standard shared guard, same as connector-service |
| Web | `<RequireCap cap="MANAGE_WORKSPACE">` wraps page; `ADMIN_SECTIONS` entry gated `cap: 'MANAGE_WORKSPACE'` | ✓ `admin/usage/page.tsx` L8, `AdminShell.tsx` L38 |
| Web base URL | `aiApi` instance (`NEXT_PUBLIC_AI_URL \|\| '/api/ai'`), own `injectToken` + 401 interceptor; `usage.ts` calls `aiApi.get('/usage/dashboard')` — NOT chatApi/authApi | ✓ `axios.ts` L22-38, `usage.ts` |
| Flutter | Admin section gated `Cap.manageWorkspace` (`admin_screen.dart` L43-44); repo uses `DioClient.createAiDio` → `aiBaseUrl` (:3002) — NOT chatDio/authDio | ✓ `usage_repository.dart`, `dio_client.dart` L62-67, `app_config.dart` L33 |

Both clients gate by `MANAGE_WORKSPACE` and hit the ai-service base directly. No bypass.

---

### Cross-platform sync (per .claude/rules/sync.md)

- Both clients render the shared core metrics from the identical endpoint: total/period tokens,
  request count, estimated cost (incl. per-model breakdown), 👎 rate, top users, worst-rated
  answers. ✓
- **D6 web-primary deviation is INTENTIONAL (accepted plan decision), not a failure:** web adds the
  daily bar chart + month selector + up-to-10 lists; mobile is a minimal read-only panel (no chart,
  no month selector, top-5/worst-5 caps). This is an admin/ops dashboard, not a chat/STOMP/message
  surface, so the sync rule's hard P1 cases (message types, STOMP events) do not apply. Recorded as
  designed.
- i18n: **complete on both platforms across all 7 locales.**
  - Web: `navUsage` + `usageDashboard` group (incl. `feedbackSummary`) present in en/vi/zh/ja/ko/es/fr — 7/7.
  - Mobile: 17 usage ARB keys present in all 7 `app_*.arb` — 17/17 each; `flutter gen-l10n` ran, generated files not hand-edited.

---

### Issues found

| Severity | File:line | Issue | Recommended fix |
|----------|-----------|-------|-----------------|
| P3 | `apps/web/lib/api/types.ts:301` + `usage-dashboard-parts.tsx:231` | `UsageWorstAnswer.createdAt` typed `string` (non-null) but backend `dashboard.types.ts:65` returns `string \| null`. Web renders `new Date(a.createdAt).toLocaleString()`; on a `null` value this yields the 1970 epoch instead of a clean blank. No crash. Flutter (`String?`) handles it correctly. | Type web field as `string \| null` and guard the render (`a.createdAt ? new Date(a.createdAt).toLocaleString() : ''`). Cosmetic; low likelihood (backend only nulls when a feedback row lacks `createdAt`). |

No P1/P2 issues. No backend-only feature missing from clients; no one-client-only feature.

---

### Owner action items (operational, not code defects)

1. **Set the per-model price-map env vars in each deployment for real cost numbers.** ai-service
   `configuration.ts` seeds defaults (`AI_PRICE_DEFAULT_IN=3`, `_OUT=15`, plus haiku/sonnet/opus
   seeds) and falls back gracefully, but `estimatedCostUsd` / `perModelCost[].costUsd` will be
   estimates off the seeded constants until `AI_PRICE_<MODELKEY>_IN/_OUT` are set to the real
   billing prices. Format: model id upper-cased, non-alphanumerics → `_` (e.g. `claude-opus-4-8`
   → `AI_PRICE_CLAUDE_OPUS_4_8_IN` / `_OUT`).
2. **Set `NEXT_PUBLIC_AI_URL` in the web deploy env** (added to `.env.local`/`.env.production`/
   `.env.example`; must also be set in the actual deploy env or the admin page falls back to
   `/api/ai` and can't reach ai-service in prod).
3. **Watch `messages` per-model aggregation latency at scale.** No `{senderId, createdAt}` index
   was added (deliberately, per plan + the prod auto-index trap). Add it explicitly only if the
   dashboard shows latency on a busy month.

---

### Conclusion

**PASS** — Backend endpoint, web full dashboard, and mobile minimal mirror all build and test
clean. Contract parity holds field-for-field across all three layers (including the high-risk
pro-rated `topUsers[].estimatedCostUsd`). Gating is correct and routed to the ai-service base on
both clients. i18n is complete in all 7 locales on both platforms. The D6 web-primary deviation is
the intended design. One P3 cosmetic type-drift on `worstAnswers[].createdAt` nullability in the
web types, and the price-map env vars must be set per deployment for accurate cost figures.
