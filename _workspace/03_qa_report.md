## QA Report — Task 4: Bot Factory Integration Token (Admin UI parity) 2026-06-25

### 빌드 상태
| 서비스 | 상태 | 비고 |
|--------|------|------|
| chat-service (`mvn -Dtest=ExternalBotAdminServiceTest test`) | ✓ PASS | exit 0; 4 tests run, 0 failures (2 pre-existing + 2 new `listAll`). BUILD SUCCESS. |
| web (`pnpm build`) | ✓ PASS | exit 0; Next.js 15 build, TypeScript strict, no `any`. |
| flutter analyze | ✓ PASS | exit 0; "No issues found! (ran in 3.5s)". SPM/plugin lines are pre-existing tooling notices. |

### API 계약 정합성
- [x] plan.md 계약과 실제 구현 일치
  - chat-service `GET /api/admin/external-bots` exists (`ExternalBotController.list()`), `@PreAuthorize("hasAuthority('PERM_MANAGE_WORKSPACE')")`, returns `List<ExternalBotResponse>` (DTO, entity never exposed).
  - connector-service (`bot-admin.controller.ts`) verified: `POST /api/bot/sessions` `{userId,botUserId}`→`{token,mcpUrl}`; `DELETE /api/bot/sessions` `{userId,botUserId}`→204; `GET /api/bot/sessions?userId=`→`{sessions:[{botUserId,createdAt,lastUsedAt}]}`. All 3 decorated `@RequirePermission(Capability.MANAGE_WORKSPACE)`.
- [x] Flutter DTO 타입 일치 — `bot_admin_repository.dart` models `BotSessionSummary{botUserId,createdAt,lastUsedAt}`, `IssuedToken{token,mcpUrl}`, `ExternalBot{id,botUserId,factoryBotId,ownerUserId,name,avatarUrl,enabled}`. Defensive `if (data is! List) return []` guard.
- [x] Web TypeScript 타입 일치 — `bot-admin.ts` same field set; `Array.isArray` coercion on both list calls.

### 크로스 플랫폼 동기화
- [x] 동일 3 actions (list / generate-one-time / revoke) — both platforms.
- [x] `lastUsedAt` → "never used" — web `LastUsed` (`neverUsed`), Flutter `_LastUsed` (`botAdminNeverUsed`).
- [x] mcpUrl shown alongside token — web `TokenDialog` CopyField; Flutter `_TokenDialog` `_CopyField`.
- [x] Token not persisted — web: local `useState`, discarded on dismiss, never in TanStack cache. Flutter: held only in dialog build scope; Riverpod stores only `BotSessionSummary` (no token).
- [x] MANAGE_WORKSPACE gate — web `<BotIntegrationPanel/>` inside `<RequireCap cap="MANAGE_WORKSPACE">` in `app/(main)/admin/ai/page.tsx`. Flutter `_Section(Cap.manageWorkspace, ...)` filtered by `caps.has(s.cap)` in `admin_screen.dart`.
- [x] Session ops keyed by `bot.ownerUserId` on both (web `BotRow`, Flutter `_BotRow`).
- [x] i18n 키 완성 (7개 언어) — web `botAdmin` group (9 keys) present in ALL 7 messages/*.json; Flutter `botAdmin*` (9 keys) present in ALL 7 app_*.arb. Verified programmatically.

### 발견된 이슈
| 심각도 | 파일:라인 | 내용 | 권장 수정 |
|--------|---------|------|----------|
| Low (P3) | `apps/client/lib/features/admin/ui/bot_integration_panel.dart:314` | Token field label is hardcoded `'Token'` (not via `context.l10n`). Minor i18n.md deviation — the token field's *label*. Copy tooltip/MCP label/warning are correctly localized. Note: web also has no dedicated `token` label key (uses `copyToken`="Integration token"); a `botAdminToken` key would unify both. Non-blocking. | Add a `botAdminToken` ARB key + web `botAdmin.token` and use it; or reuse `botAdminCopyToken`. |
| Info | `bot_integration_panel.dart:323` (Flutter) vs web `OK` button (BotIntegrationPanel.tsx:102) | Dialog dismiss labels differ: Flutter uses `actionCancel`, web uses hardcoded "OK". Cosmetic, not a parity break (both dismiss the one-time dialog). | Optional: align both to a shared close/OK key. |

### 결론
**PASS** — All three builds/tests are green (chat-service test, web build, flutter analyze all exit 0). The chat-service list endpoint exists and is MANAGE_WORKSPACE-gated; connector-service token API contract (POST/DELETE/GET `/api/bot/sessions`) matches both clients exactly and is MANAGE_WORKSPACE-gated. Web panel is RequireCap-gated with one-time non-persisted token dialog; Flutter `_Section` is Cap.manageWorkspace-gated and uses `context.l10n`. All 9 i18n keys present in all 7 locales on both platforms. Both platforms key sessions by the bot owner's userId. Only two non-blocking cosmetic/i18n nits found (one hardcoded `'Token'` label string on Flutter; dialog dismiss label mismatch). No feature code modified.
