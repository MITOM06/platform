## Web Implementation Report — TASK-13 (Usage & Quality Dashboard)

### What I built
A new admin-console section at **`/admin/usage`**, gated by the EXISTING `MANAGE_WORKSPACE`
capability via the established `RequireCap` + `use-capabilities` pattern (same as TASK-12's
`/admin/ai`). It renders the full usage & quality dashboard in one screen, fed by ai-service's
`GET /usage/dashboard` (port 3002) through a new `aiApi` axios instance. No new charting
dependency was added — the daily-tokens chart reuses the raw `<canvas>` bar approach copied from
the existing `/token-usage` page.

A new `aiApi` axios instance (4th instance) targets ai-service; it gets the same `injectToken`
request interceptor and the same 401→refresh→retry response interceptor as the other three.

### 변경된 파일
- `apps/web/lib/api/axios.ts` — added `aiApi` instance (`NEXT_PUBLIC_AI_URL || '/api/ai'`) + wired both interceptors.
- `apps/web/lib/api/types.ts` — added `DashboardResponse` + sub-types (`UsageRange`, `UsageTotals`, `UsageDailyPoint`, `UsagePerModelCost`, `UsageTopUser`, `UsageWorstAnswer`, `UsageFeedback`) — exact frozen contract shape, strict, no `any`.
- `apps/web/lib/api/usage.ts` — NEW. `usageService.getDashboard({ month?, days? })` → `aiApi.get<DashboardResponse>('/usage/dashboard', { params })`.
- `apps/web/app/(main)/admin/usage/page.tsx` — NEW. `<RequireCap cap="MANAGE_WORKSPACE"><UsageDashboard /></RequireCap>`.
- `apps/web/components/admin/usage-dashboard.tsx` — NEW (~185 lines). TanStack Query `useQuery(['admin-usage', month])`, month selector (current + previous 11), 4 headline stat cards, daily chart, and the cost/users/answers sections.
- `apps/web/components/admin/usage-dashboard-parts.tsx` — NEW (~270 lines). Extracted sub-components to keep both files < 400 lines: `StatCard`, `DailyBarChart` (canvas), `PerModelCostTable`, `TopUsersTable`, `WorstAnswers`, plus `fmtTokens`/`fmtUsd` helpers.
- `apps/web/components/admin/AdminShell.tsx` — added `{ href: '/admin/usage', cap: 'MANAGE_WORKSPACE', labelKey: 'navUsage', icon: BarChart3 }` to `ADMIN_SECTIONS` (placed right after `/admin/ai`).
- `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` — added `admin.navUsage` + the full `usageDashboard` group (22 keys) to all 7 locales.
- `apps/web/.env.local`, `.env.production`, `.env.example` — added `NEXT_PUBLIC_AI_URL` (prod Cloud Run URL; localhost:3002 in example).

### 렌더링하는 위젯 / 메트릭 (one screen)
- **Headline stat cards (4):** this-month total tokens, request count, estimated cost (`totals.estimatedCostUsd`), 👎 rate (`feedback.thumbsDownRate` as %).
- **Daily tokens chart:** canvas stacked input/output bars over `daily[]` (over-time series, zero-filled by backend). No new dep — reuses `/token-usage` canvas code.
- **Cost by model table:** `perModelCost[]` — model, input/output tokens, requests, costUsd.
- **Top users table:** `topUsers[]` — displayName, tokens, requests, estimatedCostUsd.
- **Worst-rated answers:** `feedback.worstAnswers[]` list with answer preview + optional comment + timestamp, prefixed with a feedback summary line (`{up} 👍 · {down} 👎 · {total} rated`).
- **Month selector** drives the `month` query param (YYYY-MM); query key includes `month` so switching refetches.

### TypeScript 타입 체크 결과
- `npx tsc --noEmit`: **errors: 0** (exit 0).
- `pnpm --filter @platform/web build`: **✓ Compiled successfully**, `/admin/usage` present in the route manifest.

### i18n 추가 키 (×7 locales, English shown)
admin group:
- `navUsage`: "Usage"

usageDashboard group:
- `title`: "Usage & Quality"
- `subtitle`: "Token usage, cost and answer quality across the workspace"
- `month`: "Month"
- `loading`: "Loading dashboard…"
- `loadError`: "Failed to load the usage dashboard"
- `noData`: "No data"
- `totalTokens`: "Total tokens"
- `requests`: "Requests"
- `estimatedCost`: "Estimated cost"
- `thumbsDownRate`: "👎 rate"
- `dailyChart`: "Daily tokens"
- `inputTokens`: "Input tokens"
- `outputTokens`: "Output tokens"
- `perModelCost`: "Cost by model"
- `model`: "Model"
- `cost`: "Cost"
- `topUsers`: "Top users"
- `user`: "User"
- `tokens`: "Tokens"
- `worstAnswers`: "Worst-rated answers"
- `noWorstAnswers`: "No 👎-rated answers in this period"
- `feedbackSummary`: "{up} 👍 · {down} 👎 · {total} rated"

All 7 files validated as JSON. The `usageDashboard` group is self-contained so the admin page does
not depend on the personal `tokenUsage.*` page keys.

### Backend contract conformance
Implemented exactly against the FROZEN `GET /usage/dashboard` contract in `_workspace/01_plan.md`
(note: `_workspace/02_backend_report.md` on disk documents TASK-12, not TASK-13, so the plan's
frozen contract was the authoritative source). Field-by-field:
- `range {from,to,label}` — typed.
- `totals {inputTokens,outputTokens,totalTokens,requestCount,estimatedCostUsd}` — `totalTokens`, `requestCount`, `estimatedCostUsd` shown as headline cards.
- `daily[] {date,inputTokens,outputTokens,totalTokens,requestCount}` — drives the canvas chart (same per-day shape as `/api/usage/tokens`, chart code reused as-is).
- `perModelCost[] {model,inputTokens,outputTokens,requestCount,inputPricePerMTok,outputPricePerMTok,costUsd}` — cost-by-model table.
- `topUsers[] {userId,displayName,totalTokens,requestCount,estimatedCostUsd}` — top-users table.
- `feedback {up,down,total,thumbsDownRate,worstAnswers[]}` with `worstAnswers[] {messageId,conversationId,comment,answerPreview,createdAt}` — 👎-rate card + worst-answers list; `comment` handled as nullable.
- Query params: sends `month` (YYYY-MM). `days` is supported in the service signature; the UI uses the month selector (contract: `month` wins when both present).
- Auth: relies on the server-side `MANAGE_WORKSPACE` gate; the UI also hides the section via `RequireCap` + capability-filtered `ADMIN_SECTIONS`.

### Flutter 미러 동기화 확인 (D6 — accepted web-primary deviation)
Per plan decision **D6**, this is an admin/ops dashboard (NOT a chat/message/STOMP surface), so the
sync rule's hard P1 cases do not apply; mobile gets a minimal read-only mirror panel and web is the
primary, full-featured surface.
- Web `components/admin/usage-dashboard.tsx` ↔ Flutter `usage_dashboard_panel.dart`: both consume the same `GET /usage/dashboard` and share the headline field set (this-month tokens, estimated cost, 👎 rate, top users, worst answers). Web additionally renders the daily chart + per-model cost table (mobile intentionally omits charts per D6).
- Gating matches: both behind `MANAGE_WORKSPACE`.
- i18n key group `usageDashboard` added on web (7 locales); mobile mirrors the same group in `app_*.arb`. The mobile panel itself is owned by the mobile-dev task; this report confirms the web side matches the contract and the shared field set.

### 주의사항
- `02_backend_report.md` on disk is the TASK-12 report; the TASK-13 backend report was not present, so the frozen contract in `01_plan.md` was used (the plan explicitly froze it before clients start).
- `NEXT_PUBLIC_AI_URL` was added to `.env.local`/`.env.production`/`.env.example`. The deploy env must also set it for the admin page to reach ai-service in prod.
- No charting library added (confirmed none installed); canvas + CSS bars only.
- Both new component files are under the 400-line limit (dashboard ~185, parts ~270).
