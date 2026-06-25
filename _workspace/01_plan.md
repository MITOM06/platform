# Task 4 — Admin UI: Bot Factory Integration Token (Web + Flutter parity)

Source plan: `docs/superpowers/plans/2026-06-25-identity-bridge-bot-connector.md` (Task 4).
Backend token API (connector-service :3003) is **already implemented & committed** (Tasks 1–3):
- `POST   /api/bot/sessions`  body `{ userId, botUserId }` → `{ token, mcpUrl }`  (token shown once)
- `DELETE /api/bot/sessions`  body `{ userId, botUserId }` → `204`
- `GET    /api/bot/sessions?userId=<id>` → `{ sessions: [{ botUserId, createdAt, lastUsedAt }] }`
All three require JWT + `MANAGE_WORKSPACE`.

## Gap discovered → Backend section
The admin UI needs to list registered bots to pick one. The chat-service `ExternalBotController`
only has `POST /api/admin/external-bots` (register) and `GET /api/assistant/me`. **No list endpoint exists.**
chat-service IS modifiable (only auth-service + bot-factory are off-limits). Add a read-only list endpoint.

---

## Backend section (chat-service — Spring Boot, :8080) — agent: backend-dev

Add a list endpoint so the admin UI can enumerate registered external bots.

**Files:**
- Modify `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ExternalBotAdminService.java`
  - Add `public List<ExternalBotResponse> listAll()` → `repo.findAll().stream().map(this::toResponse).toList()`.
- Modify `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ExternalBotController.java`
  - Add:
    ```java
    @GetMapping("/admin/external-bots")
    @PreAuthorize("hasAuthority('PERM_MANAGE_WORKSPACE')")
    public List<ExternalBotResponse> list() {
      return service.listAll();
    }
    ```
  - Add `import java.util.List;`
- Modify `apps/server/chat-service/src/test/java/com/platform/chatservice/service/ExternalBotAdminServiceTest.java`
  - Add a test: `listAll()` maps all repo docs to responses (mock `repo.findAll()`).

**Conventions:** constructor injection via `@RequiredArgsConstructor` (already present), DTO `ExternalBotResponse`
(never expose `@Document`). No identity from body — list is workspace-wide, admin-gated.

**Verify:** `cd apps/server/chat-service && mvn -q -DskipTests compile` must pass; run the new unit test
`mvn -q -Dtest=ExternalBotAdminServiceTest test` (offline, Mockito — no Mongo needed). Report results.

---

## Web section (apps/web — Next.js) — agent: web-dev

**Files:**
1. Create `apps/web/lib/api/bot-admin.ts`:
   - Types: `BotSessionSummary { botUserId: string; createdAt: string; lastUsedAt: string | null }`,
     `IssuedToken { token: string; mcpUrl: string }`, and `ExternalBot { id; botUserId; factoryBotId; ownerUserId; name; avatarUrl; enabled }`.
   - `botAdminService` using **`connectorApi`** (connector-service :3003) for token ops:
     - `issue(userId, botUserId): Promise<IssuedToken>` → `connectorApi.post('/api/bot/sessions', { userId, botUserId })`
     - `revoke(userId, botUserId): Promise<void>` → `connectorApi.delete('/api/bot/sessions', { data: { userId, botUserId } })`
     - `listSessions(userId): Promise<BotSessionSummary[]>` → `connectorApi.get('/api/bot/sessions', { params: { userId } }).then(r => r.data.sessions ?? [])`
   - `listExternalBots(): Promise<ExternalBot[]>` using **`chatApi`** → `chatApi.get('/api/admin/external-bots').then(r => Array.isArray(r.data) ? r.data : [])`.
   - Mirror the defensive `Array.isArray` coercion pattern already in `lib/api/connector.ts`.
   - Import `connectorApi`, `chatApi` from `./axios`.
2. Create `apps/web/components/admin/BotIntegrationPanel.tsx` (`'use client'`, ≤400 lines):
   - TanStack Query: `useQuery` for `listExternalBots()` and (per displayed user) `listSessions(userId)`.
   - For each registered bot row: show name, `botUserId`, owner; a **Generate token** button (mutation → `issue`);
     show `lastUsedAt` (or "never used"); a **Revoke** button (mutation → `revoke`, invalidates the sessions query).
   - On successful `issue`: open a shadcn `Dialog` showing the **token** and **mcpUrl** in copyable fields
     (use a Copy button writing to `navigator.clipboard`), with the warning text `botAdmin.tokenWarning`.
     After dismiss, the token is gone (do NOT persist it in state beyond the dialog).
   - Empty state: `botAdmin.noBotsRegistered`.
   - Use existing shadcn components from `components/ui/` (dialog, button, input). Do NOT hand-edit `components/ui/`.
3. Modify `apps/web/app/(main)/admin/ai/page.tsx`:
   - Render `<BotIntegrationPanel />` below `<WorkspaceAiSettings />`, inside the existing
     `<RequireCap cap="MANAGE_WORKSPACE">`.
4. i18n — add a `botAdmin` group to ALL 7 `apps/web/messages/*.json` (en, vi, zh, ja, ko, es, fr):
   keys: `title, generateToken, revokeToken, tokenWarning, copyToken, mcpUrl, lastUsed, neverUsed, noBotsRegistered`.
   Use `next-intl` `useTranslations('botAdmin')` in the component. en is the source; translate the rest
   (reasonable translations, not English fallbacks).

**Verify:** `cd apps/web && pnpm build` (or `pnpm lint && pnpm tsc --noEmit`) must pass. TypeScript strict, no `any`.

---

## Mobile section (apps/client — Flutter) — agent: mobile-dev

**Parity with web** (sync.md): same fields, same actions, same i18n keys.

**Files:**
1. Create `apps/client/lib/features/admin/data/bot_admin_repository.dart`:
   - Token ops over **`DioClient.createConnectorDio(...)`** (connector :3003):
     - `Future<({String token, String mcpUrl})> issue(String userId, String botUserId)` → POST `/api/bot/sessions`.
     - `Future<void> revoke(String userId, String botUserId)` → DELETE `/api/bot/sessions` with `data: {...}`.
     - `Future<List<BotSessionSummary>> listSessions(String userId)` → GET `/api/bot/sessions?userId=`.
   - `listExternalBots()` over **`DioClient.createChatDio(...)`** → GET `/api/admin/external-bots`.
   - Add a small model `BotSessionSummary { botUserId, createdAt, lastUsedAt? }` and `ExternalBot { botUserId, name, ownerUserId, ... }`
     (place models in this file or `data/models/` — match existing style in `features/integrations/data`).
   - Provide a Riverpod `Provider` for the repository, mirroring `adminRepositoryProvider` and the
     connector repo in `apps/client/lib/features/integrations/data/connector_repository.dart`
     (use `DioClient.createConnectorDio` / `createChatDio` with `onForceLogout`).
2. Create `apps/client/lib/features/admin/ui/bot_integration_panel.dart` (`ConsumerWidget`/`ConsumerStatefulWidget`, ≤400 lines):
   - `AsyncValue.when(...)` for the bot list; per-bot Generate token + Revoke + lastUsed display.
   - On generate: show a dialog with token + mcpUrl, a Copy action (`Clipboard.setData`), and the warning.
   - Neon dark theme (`AppTheme.ponCyan`, `AppTheme.darkBackground`, `AppTheme.darkBorder`); use `withValues(alpha:)`.
   - All strings via `context.l10n.botAdmin*` (NO hardcoded UI strings).
3. Modify `apps/client/lib/features/admin/ui/admin_screen.dart`:
   - Add a new `_Section(Cap.manageWorkspace, Icons.smart_toy_outlined, (c) => c.l10n.botAdminTitle, const BotIntegrationPanel())`
     to `_sections()` (place after the AI section). Import the panel.
4. i18n — add keys to ALL 7 `apps/client/lib/l10n/app_*.arb` then run `flutter gen-l10n`:
   `botAdminTitle, botAdminGenerateToken, botAdminRevokeToken, botAdminTokenWarning, botAdminCopyToken,
    botAdminMcpUrl, botAdminLastUsed, botAdminNeverUsed, botAdminNoBotsRegistered`.
   (Flutter ARB uses flat camelCase keys, not nested groups — see `.claude/rules/i18n.md`.)
   en is template; add to all 7 (reasonable translations). Do NOT manually edit generated `app_localizations*.dart`.

**Verify:** `cd apps/client && flutter gen-l10n && flutter analyze` must be clean (no new errors). Report results.

---

## Parity checklist (both platforms must match)
- [ ] Same three actions: list bots, generate token (one-time modal w/ copy + warning), revoke.
- [ ] `lastUsedAt` shown (→ "never used" when null) on both.
- [ ] mcpUrl shown alongside token on both.
- [ ] Capability gate `MANAGE_WORKSPACE` on both (web `RequireCap`, Flutter `_Section` cap filter).
- [ ] Same i18n keys present in all 7 locales on each platform.
- [ ] Token never persisted client-side beyond the one-time dialog.
