# BotFather Zone — Personal Assistant Self-Service Setup

> **Analogy:** Telegram's BotFather lets any user create a bot and receive a token that wires their external logic into Telegram. PON's BotFather Zone lets any member set up their personal assistant — PON handles all wiring with Bot Factory automatically.
>
> **Required sub-skills:** Use `superpowers:executing-plans` for Tasks 1–4 (backend). Use `superpowers:orchestrate-feature` for Tasks 5–6 (web + Flutter, must satisfy `sync.md`).

---

## Goal

A member opens PON, goes to **"Trợ lý của tôi"**, completes a setup wizard (name, persona, AI model), clicks **"Tạo trợ lý"** — and their personal assistant immediately appears in the chat sidebar. No admin intervention. No touching Bot Factory UI.

---

## User Journey

```
Member → "Trợ lý của tôi" (sidebar or settings)
  → [No assistant yet] → Setup wizard appears
      Step 1: Đặt tên & avatar cho trợ lý
      Step 2: Tính cách / Mô tả ngữ cảnh (system prompt)
      Step 3: Chọn model AI (list từ Bot Factory providers)
      Step 4: Tools được bật (Gmail, Calendar... từ connector-service)
  → "Tạo trợ lý" button
  → PON tự động:
       1. Tạo bot trong Bot Factory (POST /api/bots)
       2. Set persona + model (PATCH /api/bots/{id})
       3. Generate MCP token (connector-service)
       4. Inject MCP server vào bot (POST /api/bots/{id}/mcp)
       5. Register mapping trong chat-service
  → "Trợ lý" xuất hiện trong sidebar → member nhắn tin ngay

Member muốn chỉnh sửa sau:
  → "Cài đặt trợ lý" → edit name, persona, model, tools
  → "Xoá trợ lý" → tear down toàn bộ (revoke token, xoá bot Factory, xoá mapping)
```

---

## Architecture

```
chat-service (port 8080)  ←  mọi request từ member
  AssistantProvisioningService
    │  step 1-2: POST/PATCH /api/bots          x-worker-token
    │  step 3:   POST /api/bots/{id}/mcp       x-worker-token
    ▼
  BotFactoryAdminClient (extends BotFactoryClient)

  AssistantProvisioningService
    │  step 2: POST /api/bot/sessions           x-internal-key
    ▼
  ConnectorServiceClient (new)

  AssistantProvisioningService
    │  step 5: ExternalBotAdminService.register()  (internal call, same service)
    ▼
  ExternalBot collection (Mongo)
```

**Vì sao orchestration nằm ở chat-service:** nó đã có `BotFactoryClient`, `ExternalBotAdminService`, `AiMessageService`. Thêm 2 client mới là đủ — không cần service mới.

---

## Global Constraints

- **bot-factory READ-ONLY** — không sửa code. Chỉ gọi API với `x-worker-token`.
- **Không sửa auth-service.**
- **sync.md:** Task 5 (web) và Task 6 (Flutter) phải trong cùng commit, dùng `orchestrate-feature`.
- **Build verify sau mỗi task:** `mvn -q -Dtest=<ClassName> test` (Tasks 1–4); `pnpm build` (Task 5).
- Self-service endpoint **không yêu cầu** `PERM_MANAGE_WORKSPACE` — bất kỳ member active nào cũng tự setup được, chỉ scoped về `userId` của chính họ.
- Env mới cần thêm vào `chat-service`: `CONNECTOR_SERVICE_BASE_URL`, `CONNECTOR_INTERNAL_KEY`.

All paths relative to `apps/server/chat-service/src/main/java/com/platform/chatservice/`.

---

## Task 1 — BotFactoryAdminClient

Extend `BotFactoryClient` với các phương thức CRUD bot + MCP injection. Dùng cùng pattern JDK `HttpClient` + `BOTFACTORY_WORKER_TOKEN`.

**Files:**
- Modify: `service/BotFactoryClient.java`
- Create: `dto/BotFactoryBotRequest.java`
- Create: `dto/BotFactoryBotResponse.java`
- Create: `dto/BotFactoryMcpRequest.java`
- Create: `dto/BotFactoryProviderResponse.java`

**Methods to add to BotFactoryClient:**

```java
/** Tạo bot mới trong Bot Factory. Trả về botId. */
public String createBot(String name, String systemPrompt) { ... }

/** Cập nhật persona + model của bot. */
public void updateBot(String botId, String name, String systemPrompt,
                      String defaultProviderId) { ... }

/** Xoá bot khỏi Bot Factory. */
public void deleteBot(String botId) { ... }

/** Thêm MCP server HTTP vào bot với Bearer auth. */
public void addMcpServer(String botId, String mcpName,
                         String mcpUrl, String bearerToken) { ... }

/** Xoá MCP server của PON khỏi bot (theo name). */
public void removePonMcpServer(String botId) { ... }

/** Lấy danh sách AI providers (để member chọn model). */
public List<BotFactoryProviderResponse> listProviders() { ... }
```

**DTO schemas (map từ Bot Factory API):**

```java
// POST /api/bots body
record BotFactoryBotRequest(String name, String description,
                             String systemPrompt, String defaultProviderId) {}

// Response từ GET/POST /api/bots
record BotFactoryBotResponse(String id, String name, String systemPrompt,
                              String defaultProviderId) {}

// POST /api/bots/{id}/mcp body
record BotFactoryMcpRequest(String name, String transport,
                             String url, String headers, String authType) {}
// transport = "http", authType = "apikey"
// headers = JSON string: {"Authorization":"Bearer <token>"}

// GET /api/providers item
record BotFactoryProviderResponse(String id, String label,
                                   String provider, String model) {}
```

- [ ] **Step 1** — Create DTOs.
- [ ] **Step 2** — Add methods to `BotFactoryClient`. Pattern:
  ```java
  HttpRequest req = HttpRequest.newBuilder()
      .uri(URI.create(baseUrl + "/api/bots"))
      .header("x-worker-token", workerToken)
      .header("Content-Type", "application/json")
      .POST(HttpRequest.BodyPublishers.ofString(json))
      .build();
  HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
  ```
- [ ] **Step 3** — Build verify: `mvn -q compile`.
- [ ] **Step 4** — Commit:
  ```
  feat(chat): BotFactoryAdminClient — bot CRUD + MCP injection
  ```

---

## Task 2 — ConnectorServiceClient

HTTP client để gọi connector-service nội bộ: issue bot session token + revoke.

**Files:**
- Create: `service/ConnectorServiceClient.java`
- Create: `dto/BotSessionRequest.java`
- Create: `dto/BotSessionResponse.java`
- Modify: `config/AppConfig.java` (thêm env `CONNECTOR_SERVICE_BASE_URL`, `CONNECTOR_INTERNAL_KEY`)

**Interface:**

```java
@Service
public class ConnectorServiceClient {

  /**
   * Gọi POST /api/bot/sessions trên connector-service.
   * Trả về { token, mcpUrl }.
   */
  public BotSessionResponse issueToken(String userId, String botUserId) { ... }

  /**
   * Gọi DELETE /api/bot/sessions trên connector-service.
   */
  public void revokeToken(String userId, String botUserId) { ... }
}
```

Auth header: `Authorization: Bearer <JWT_ACCESS_SECRET>` — connector-service dùng `JwtAuthGuard` cho `/api/bot/sessions`. Chat-service cần ký 1 JWT admin nội bộ, hoặc đơn giản hơn: expose 1 internal endpoint mới trong connector-service dùng `x-internal-key` thay vì JWT.

> **Chọn x-internal-key pattern** (đã có `InternalKeyGuard` trong connector-service): thêm `BotAdminController` route dùng `x-internal-key` thay vì JWT. Đây là internal-only call, không phải user-facing.

**Modify connector-service `BotAdminController`:**

```ts
// Thêm route protected bằng InternalKeyGuard (không phải JwtAuthGuard)
// POST /internal/bot/sessions  →  issue token  →  { token, mcpUrl }
// DELETE /internal/bot/sessions  →  revoke
```

- [ ] **Step 1** — Sửa `BotAdminController` (connector-service): thêm `POST /internal/bot/sessions` + `DELETE /internal/bot/sessions` với `InternalKeyGuard`. (Giữ nguyên `POST /api/bot/sessions` cũ cho admin JWT flow.)
- [ ] **Step 2** — Tạo `ConnectorServiceClient.java` trong chat-service.
- [ ] **Step 3** — Build verify cả 2 service.
- [ ] **Step 4** — Commit:
  ```
  feat(chat+connector): ConnectorServiceClient + internal bot session endpoint
  ```

---

## Task 3 — AssistantProvisioningService

Service orchestration: tạo → wire → register. Và tear-down khi member xoá trợ lý.

**Files:**
- Create: `service/AssistantProvisioningService.java`
- Create: `dto/AssistantSetupRequest.java`
- Create: `dto/AssistantSetupResponse.java`

**Interface:**

```java
@Service
@RequiredArgsConstructor
public class AssistantProvisioningService {

  /**
   * Full setup flow cho 1 member:
   * 1. Tạo bot trong Bot Factory
   * 2. Issue MCP token (connector-service)
   * 3. Inject MCP server vào bot
   * 4. Register ExternalBot mapping (chat-service)
   * Idempotent: nếu đã có mapping thì update, không tạo mới.
   */
  @Transactional
  public AssistantSetupResponse provision(String userId, AssistantSetupRequest req) { ... }

  /**
   * Tear-down: revoke MCP token, xoá bot Factory, xoá ExternalBot mapping.
   * Nếu bước nào fail vẫn tiếp tục (best-effort cleanup).
   */
  public void tearDown(String userId) { ... }

  /**
   * Update persona/model cho bot đã tồn tại.
   */
  public void update(String userId, AssistantSetupRequest req) { ... }

  /**
   * Lấy danh sách AI providers từ Bot Factory (để member chọn).
   */
  public List<BotFactoryProviderResponse> listProviders() { ... }
}
```

**AssistantSetupRequest:**
```java
record AssistantSetupRequest(
    String name,           // tên trợ lý
    String systemPrompt,   // persona
    String providerId      // Bot Factory provider id member chọn
) {}
```

**AssistantSetupResponse:**
```java
record AssistantSetupResponse(
    String botUserId,   // "extbot:<factoryBotId>"
    String name
) {}
```

**Provision logic:**
```
factoryBotId = botFactoryClient.createBot(name, systemPrompt)
botFactoryClient.updateBot(factoryBotId, name, systemPrompt, providerId)
sessionResult = connectorClient.issueToken(userId, "extbot:" + factoryBotId)
botFactoryClient.addMcpServer(factoryBotId, "pon-connector",
    sessionResult.mcpUrl(), sessionResult.token())
externalBotAdminService.register(userId, factoryBotId, name, null)
```

- [ ] **Step 1** — Write failing test `AssistantProvisioningServiceTest` (mock clients).
- [ ] **Step 2** — Implement `AssistantProvisioningService`.
- [ ] **Step 3** — Tests PASS. Build verify.
- [ ] **Step 4** — Commit:
  ```
  feat(chat): AssistantProvisioningService — full bot setup orchestration
  ```

---

## Task 4 — Self-Service REST Endpoints

Member-facing API. Không cần `PERM_MANAGE_WORKSPACE` — scoped về userId của caller.

**Files:**
- Create: `controller/AssistantSetupController.java`

**Endpoints:**

```
POST   /api/assistant/setup        → provision (tạo hoặc update nếu đã có)
DELETE /api/assistant/setup        → tearDown
GET    /api/assistant/providers    → listProviders (list AI providers từ Bot Factory)
GET    /api/assistant/me           ← đã có trong ExternalBotController, giữ nguyên
```

**Controller:**

```java
@RestController
@RequestMapping("/api/assistant")
@RequiredArgsConstructor
public class AssistantSetupController {

  private final AssistantProvisioningService provisioning;

  @PostMapping("/setup")
  public AssistantSetupResponse setup(@RequestBody @Valid AssistantSetupRequest req,
                                       @AuthenticationPrincipal UserPrincipal principal) {
    return provisioning.provision(principal.getUserId(), req);
  }

  @DeleteMapping("/setup")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void tearDown(@AuthenticationPrincipal UserPrincipal principal) {
    provisioning.tearDown(principal.getUserId());
  }

  @GetMapping("/providers")
  public List<BotFactoryProviderResponse> providers() {
    return provisioning.listProviders();
  }
}
```

- [ ] **Step 1** — Implement `AssistantSetupController`.
- [ ] **Step 2** — Add `CONNECTOR_SERVICE_BASE_URL` + `CONNECTOR_INTERNAL_KEY` vào `application.yml`.
- [ ] **Step 3** — Build + run existing tests: `mvn -q test`.
- [ ] **Step 4** — Commit:
  ```
  feat(chat): /api/assistant/setup self-service endpoints
  ```

---

## Task 5+6 — BotFather Zone UI (Web + Flutter)

> **Sub-skill:** Dùng `superpowers:orchestrate-feature`. Web và Flutter PHẢI trong cùng commit.

**New pages/screens:**

### Web (`apps/web`)

- **`/assistant/setup`** (or modal from sidebar) — Setup wizard 4 steps:
  - Step 1: Name + optional avatar emoji picker
  - Step 2: System prompt textarea (placeholder gợi ý mẫu)
  - Step 3: Provider/model selector (từ `GET /api/assistant/providers`)
  - Step 4: Confirm + "Tạo trợ lý" button → loading → redirect to chat with assistant
- **`/assistant/settings`** — Edit page (hiện sau khi đã có trợ lý):
  - Sửa name, persona, model
  - "Xoá trợ lý" button (với confirmation dialog)
- **Sidebar `AssistantEntry.tsx`** (đã có):
  - Nếu `assistant == null` → show "Thiết lập trợ lý" link → `/assistant/setup`
  - Nếu có → show bot name + link vào chat (giữ nguyên)
  - Thêm gear icon → `/assistant/settings`

**API client (`apps/web/lib/api/assistant-setup.ts`):**
```ts
export const assistantSetupApi = {
  setup: (req: AssistantSetupRequest) =>
    chatApi.post<AssistantSetupResponse>('/assistant/setup', req),
  tearDown: () => chatApi.delete('/assistant/setup'),
  listProviders: () => chatApi.get<BotFactoryProvider[]>('/assistant/providers'),
}
```

### Flutter (`apps/client`)

- **`AssistantSetupScreen`** — Wizard steps dùng `PageView` + progress indicator
  - Step 1: `TextField` tên + emoji picker
  - Step 2: `TextField` multiline cho system prompt
  - Step 3: `ListView` chọn provider/model
  - Step 4: Preview card + "Tạo trợ lý" `PonButton`
- **`AssistantSettingsScreen`** — Edit + delete (gated by `canAccessAssistant`)
- **`AssistantEntryTile`** (đã có) — Thêm settings icon + link sang setup nếu null

**i18n keys:**
```
assistantSetup.title, assistantSetup.stepName, assistantSetup.stepPersona,
assistantSetup.stepModel, assistantSetup.stepConfirm,
assistantSetup.namePlaceholder, assistantSetup.personaPlaceholder,
assistantSetup.personaHint, assistantSetup.createButton,
assistantSetup.creating, assistantSetup.success,
assistantSettings.title, assistantSettings.editPersona,
assistantSettings.changeModel, assistantSettings.deleteTitle,
assistantSettings.deleteConfirm, assistantSettings.deleteButton
```

---

## Manual End-to-End Verification

1. Login PON app → sidebar → "Thiết lập trợ lý" (nếu chưa có).
2. Điền wizard: tên "Aria", persona "Bạn là trợ lý thông minh của tôi", chọn model Claude.
3. Click "Tạo" → loading ~2s → "Aria" xuất hiện trong sidebar.
4. Nhắn tin "Xin chào" → Aria reply.
5. Nhắn "Tóm tắt email chưa đọc hôm nay" → Aria dùng Gmail tool (nếu member đã connect Gmail).
6. Vào settings → đổi tên thành "Max" → sidebar cập nhật tên.
7. Xoá trợ lý → sidebar quay về "Thiết lập trợ lý".
8. Kiểm tra Bot Factory: bot đã bị xoá.
9. Kiểm tra connector-service: session token đã bị revoke.

---

## Out of Scope (follow-up)

- Admin xem danh sách tất cả bots của members (monitoring).
- Member upload ảnh avatar thay vì emoji.
- Member chọn skill/tool thủ công (hiện tại tự động inject toàn bộ connected tools qua MCP).
- Bot Factory provider management từ PON admin panel (hiện tại admin tự config trong Bot Factory UI).
