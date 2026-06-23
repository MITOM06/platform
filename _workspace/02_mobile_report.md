## Mobile Implementation Report — TASK-13 (Usage & Quality Dashboard, minimal read-only mirror)

### What was built
A minimal, read-only **Usage** panel in the existing Flutter admin console
(`AdminScreen`), gated by the **existing** `MANAGE_WORKSPACE` capability via the
existing `hasCapability` / section-filter pattern — placed right after the
TASK-12 "AI Settings" panel (`Cap.manageWorkspace`). It fetches the SAME
`GET /usage/dashboard` (ai-service, :3002) endpoint the web `/admin/usage` page
uses and shows the same core metrics: this period's tokens & requests, estimated
cost (total + per-model), top users, 👎 rate, and worst-rated answers. No charts
(web-primary deviation D6) — simple Neon-themed cards/lists. Pull-to-refresh +
retry on error.

### 변경된 파일 (Files touched)
- `apps/client/lib/core/config/app_config.dart` — **수정**. Added `aiBaseUrl`
  (ai-service :3002; self-host routes via `/api/ai`, cloud uses the ai-service
  Cloud Run URL), mirroring the existing auth/chat/connector pattern.
- `apps/client/lib/core/api/dio_client.dart` — **수정**. Added `createAiDio(...)`
  (dedicated ai-service Dio with the same JWT/refresh/network interceptors) +
  `aiBaseUrl` getter. Never reuses chat/auth Dio (per the project footgun rule).
- `apps/client/lib/features/admin/data/models/usage_dashboard_models.dart` —
  **신규** (204 lines). Dart models for `DashboardResponse`: `UsageDashboard`,
  `UsageRange`, `UsageTotals`, `PerModelCost`, `TopUser`, `WorstAnswer`,
  `UsageFeedback`. Defensive parsing — every number defaults to 0, every list to
  empty, nullable strings stay nullable; a sparse/empty payload never throws.
- `apps/client/lib/features/admin/data/usage_repository.dart` — **신규**.
  `UsageRepository.getDashboard({String? month})` → `aiDio.get('/usage/dashboard')`
  with optional `month` query param. `usageRepositoryProvider` wires `createAiDio`
  with `forceLogout`.
- `apps/client/lib/features/admin/state/usage_dashboard_provider.dart` — **신규**.
  `UsageDashboardNotifier extends AsyncNotifier<UsageDashboard>` (current month)
  with `refresh()`.
- `apps/client/lib/features/admin/ui/widgets/usage_dashboard_panel.dart` — **신규**
  (155 lines). `ConsumerWidget` with `AsyncValue.when` loading/error/data; range
  label, 4 headline stat cards, and the three sections.
- `apps/client/lib/features/admin/ui/widgets/usage_dashboard_widgets.dart` — **신규**
  (265 lines). Extracted sub-widgets (per-model cost list, top-users list,
  worst-answers cards, stat card, empty row, formatters) — split out to keep
  every file under the 400-line limit (panel was 424 before the split).
- `apps/client/lib/features/admin/ui/admin_screen.dart` — **수정**. Added the
  Usage section (`Cap.manageWorkspace`, `Icons.insights_outlined`,
  `c.l10n.adminNavUsage`, `UsageDashboardPanel`) after AI Settings.
- `apps/client/lib/l10n/app_{en,vi,zh,ja,ko,es,fr}.arb` — **수정 (×7)**. +17 keys
  each (en is the template, with placeholder metadata). Ran `flutter gen-l10n` →
  regenerated `app_localizations*.dart` (not hand-edited).

### Metrics shown (parity with web)
| Metric | Source field | Mobile render |
|--------|-------------|---------------|
| This period label | `range.label` | Header chip (falls back to "This month") |
| Total tokens | `totals.totalTokens` | Headline stat card |
| Requests | `totals.requestCount` | Headline stat card |
| Estimated cost | `totals.estimatedCostUsd` | Headline stat card (`$x.xx`) |
| 👎 rate | `feedback.thumbsDownRate` + `down`/`total` | Headline stat card (`%`, red ≥20%, breakdown subtitle) |
| Cost by model | `perModelCost[]` | List: model · cost · in/out/req tokens |
| Top users | `topUsers[]` (top 5) | Ranked list: name/userId · tokens · requests |
| Worst answers | `feedback.worstAnswers[]` (top 5) | Cards: answer preview + optional comment |

Web is primary (it additionally has the daily bar chart and month selector). Per
plan **D6**, mobile intentionally omits charts and the month selector and caps
top-users / worst-answers at 5 (web shows up to 10) — this is the explicitly
accepted sync-rule deviation for an admin/ops dashboard (not a chat/STOMP
surface). The headline numbers come from the identical endpoint, so they match.

### Contract conformance
- Calls `GET /usage/dashboard` on ai-service exactly as the frozen contract in
  `01_plan.md` (Auth: `Bearer <jwt>`; optional `month=YYYY-MM`; defaults to
  current month). Same endpoint the web dashboard uses.
- Parses every contract field: `range.{from,to,label}`,
  `totals.{inputTokens,outputTokens,totalTokens,requestCount,estimatedCostUsd}`,
  `perModelCost[].{model,inputTokens,outputTokens,requestCount,inputPricePerMTok,outputPricePerMTok,costUsd}`,
  `topUsers[].{userId,displayName,totalTokens,requestCount,estimatedCostUsd}`,
  `feedback.{up,down,total,thumbsDownRate,worstAnswers[]}`,
  `worstAnswers[].{messageId,conversationId,comment,answerPreview,createdAt}`.
- `topUsers` displayName falls back to `userId` (contract note). Empty window →
  zeros + empty lists + `0%` 👎 rate (no NaN), rendered as a clean empty state.
- Gated by `MANAGE_WORKSPACE` (client section filter + server gate).

### i18n 추가 키 (17 keys × 7 locales)
- `adminNavUsage`: "Usage"
- `usageThisMonth`: "This month"
- `usageTotalTokens`: "Total tokens"
- `usageRequests`: "Requests"
- `usageEstCost`: "Estimated cost"
- `usageThumbsDownRate`: "Thumbs-down rate"
- `usageFeedbackBreakdown(down, total)`: "{down} of {total} rated"
- `usagePerModelTitle`: "Cost by model"
- `usageModelTokens(input, output, requests)`: "{input} in / {output} out · {requests} req"
- `usageTopUsersTitle`: "Top users"
- `usageUserRequests(count)`: "{count} requests"
- `usageWorstAnswersTitle`: "Worst-rated answers"
- `usageNoPreview`: "(no answer preview)"
- `usageUserComment(comment)`: "“{comment}”"
- `usageNoData`: "No data for this period."
- `usageLoadError`: "Could not load the usage dashboard."
- `usageRetry`: "Retry"

All 17 added to **all 7 locales** (en/vi/zh/ja/ko/es/fr) with native translations
— no English fallthrough. `flutter gen-l10n` succeeded; generated
`app_localizations*.dart` not hand-edited.

### analyze + test results (exact)
- `cd apps/client && flutter analyze` → **No issues found!** (0 issues)
- `flutter test` → **All tests passed!** — 47 tests (+47). Full suite run (not just
  analyze, per the instruction). No new test added for this read-only UI-only
  mirror; logic lives in the defensively-parsed models and existing widgets.

### File-length compliance
- `usage_dashboard_panel.dart`: 155 · `usage_dashboard_widgets.dart`: 265 ·
  `usage_dashboard_models.dart`: 204 — all < 400.

### 주의사항 (Notes)
- **Stale workspace reports**: `_workspace/02_backend_report.md` and
  `02_web_report.md` are both TASK-12 reports; the TASK-13 `/usage/dashboard`
  endpoint does NOT yet exist in `apps/server/ai-service/src/usage/`. I therefore
  implemented strictly against the **frozen contract in `01_plan.md`** (as the
  task instructs when no TASK-13 backend report is present). When the backend
  lands, no mobile change should be needed if it honors the frozen shape.
- **Base URL**: added a dedicated `aiBaseUrl` + `createAiDio` per the plan. (The
  existing `ai_memory_repository.dart` reaches `/api/ai/...` via chatDio :8080;
  TASK-13 deliberately uses the ai-service base directly per the plan, matching
  the web `aiApi` instance decision.) Self-host (`PON_DOMAIN`) routes via
  `/api/ai`; cloud uses the ai-service Cloud Run URL.
- **Sync (D6)**: documented above — mobile is a minimal read-only mirror; the
  intentional deltas (no chart, no month selector, top-5 caps) are the accepted
  web-primary deviation, not P1 sync gaps (admin/ops view, not a chat/STOMP
  message surface).
- **ARB reformat**: the JSON writer pretty-printed two pre-existing placeholder
  blocks from one-line to multi-line (semantically identical JSON, valid ARB) —
  no key values changed.
