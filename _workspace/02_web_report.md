## Web Implementation Report — Bot Factory Integration Token

### 변경된 파일
- `apps/web/lib/api/bot-admin.ts` (new) — Types (`BotSessionSummary`, `IssuedToken`, `ExternalBot`) + `botAdminService` (issue/revoke/listSessions via `connectorApi`, listExternalBots via `chatApi`). `Array.isArray` coercion mirrors `lib/api/connector.ts`.
- `apps/web/components/admin/BotIntegrationPanel.tsx` (new, 'use client', ~250 lines) — TanStack Query bot list + per-bot sessions; per-row Generate/Revoke mutations; one-time `Dialog` showing token + mcpUrl with copy buttons and `tokenWarning`. Token kept only in local `useState`, discarded on dismiss (not cached/persisted).
- `apps/web/app/(main)/admin/ai/page.tsx` (modified) — renders `<BotIntegrationPanel />` below `<WorkspaceAiSettings />`, inside existing `<RequireCap cap="MANAGE_WORKSPACE">`.
- `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` (modified) — added `botAdmin` group to all 7.

### TypeScript 타입 체크 결과
- `pnpm exec tsc --noEmit`: errors = 0
- `pnpm build`: PASS (exit 0). No `any` used; strict mode clean.

### i18n 추가 키 (botAdmin group, en source)
- `title`: "Bot Factory integration"
- `generateToken`: "Generate token"
- `revokeToken`: "Revoke"
- `tokenWarning`: "Copy this token now — it is shown only once and cannot be retrieved later."
- `copyToken`: "Integration token"
- `mcpUrl`: "MCP URL"
- `lastUsed`: "Last used"
- `neverUsed`: "Never used"
- `noBotsRegistered`: "No bots registered yet."
All 7 locales translated (not English fallbacks).

### Flutter 미러 파일 동기화 확인
- `BotIntegrationPanel.tsx` ↔ `bot_integration_panel.dart`: mobile-dev 담당 (parity 계획 일치 — 동일 3 actions, lastUsed→neverUsed, mcpUrl, MANAGE_WORKSPACE gate, 동일 키 세트).

### 주의사항
- Session ops use `bot.ownerUserId` as the `userId` (token is the owner↔bot pairing); confirm backend semantics match.
- `GET /api/admin/external-bots` (chat-service) is added by backend-dev in parallel; web codes against documented `ExternalBot[]` shape and tolerates non-array (empty state).
