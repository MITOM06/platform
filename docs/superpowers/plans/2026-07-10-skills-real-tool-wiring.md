# Plan: Wire các "action skill" vào tool thật (scheduler / mailWriter / projectKeeper / inboxTriage)

> **Ngày:** 2026-07-10
> **Scope:** `apps/server/ai-service/src/skills/`, `apps/server/ai-service/src/tools/tool-registry.service.ts`.
> **Đi kèm:** `2026-07-10-skills-copy-honesty-fix.md` (copy fix, làm trước/song song).
> **1 phần KHÔNG thể làm bằng code — cần secret từ user, nói rõ ở cuối.**

---

## Phát hiện quan trọng trước khi thiết kế fix

Đã đọc `tool-registry.service.ts` kỹ hơn lần trước — hệ thống tool THẬT phức tạp hơn mô tả ban đầu:

1. **Tool thật đã tồn tại**, độc lập hoàn toàn với "skill":
   - `web_search` (`WebSearchTool` + `WebSearchService`) — CÓ THẬT, nhưng chỉ đăng ký khi
     `ctx.webSearchEnabled !== false` **và** `webSearchService.isAvailable()`.
   - `create_reminder`, `search_knowledge_base`, `summarize_conversation`, `search_messages`,
     `get_user_info` — static tool, luôn có sẵn, không liên quan skill/connector nào.
   - MCP dynamic tools (Notion/Gmail/Calendar thật) qua `mcpConnector.getTools(userId)` — chỉ có khi
     **user đã connect connector đó** (OAuth), lọc tiếp qua `allowedConnectors` (RBAC workspace).
2. **`ToolRegistryService` không đọc skill nào cả** — tool có sẵn hay không chỉ phụ thuộc (a) connector
   đã connect + (b) RBAC allow-list. Bật/tắt skill KHÔNG ảnh hưởng danh sách tool AI được dùng.
3. **`web_search` hiện KHÔNG hoạt động trên deployment này** — đã check thẳng
   `apps/server/ai-service/.env`:
   ```
   WEB_SEARCH_ENABLED=true
   WEB_SEARCH_PROVIDER=generic
   WEB_SEARCH_API_URL=
   WEB_SEARCH_API_KEY=
   ```
   `GenericSearchProvider.isConfigured()` = `Boolean(apiKey && apiUrl)` → cả 2 đang rỗng → `false` →
   `isAvailable()` = `false` → tool **không bao giờ được đăng ký**, bất kể skill "Web Searcher" có
   bật hay không. **Đây rất có thể là nguyên nhân trực tiếp** khiến "Web Searcher" trông như
   "không xài được" — không phải do skill thiếu tool-wiring, mà do provider chưa có API key.

   → **Việc này KHÔNG thể fix bằng code/plan.** Cần user cung cấp 1 trong 2:
   - `WEB_SEARCH_API_URL` + `WEB_SEARCH_API_KEY` cho 1 search API thật (Brave Search API, Tavily,
     SerpAPI... — provider "generic" gọi `GET {url}?q=...&count=...` và tự parse vài shape response
     phổ biến, xem `generic-search.provider.ts` để biết field nó chấp nhận), hoặc
   - Đổi `WEB_SEARCH_PROVIDER=anthropic` — nhưng đọc code, `AnthropicWebSearchProvider` hiện là
     **"no-op stub"** (theo comment trong `.env.example`) — chưa thật sự implement, nên không phải
     lựa chọn dùng được ngay, chỉ generic mới hoạt động thật.
   - **Không có provider weather nào tồn tại trong code** — `weatherForecast` skill không có tool
     thật đứng sau, khác với `webSearch` (có tool nhưng thiếu key). Wiring weather thật = build tool
     + connector mới hoàn toàn (gọi OpenWeather/WeatherAPI...), KHÔNG nằm trong scope plan này —
     cần quyết định riêng nếu muốn làm.

---

## Phân loại lại: skill nào có thể wire vào hành động thật, skill nào không

| Skill | Có tool thật sẵn có trong code? | Kết luận |
|---|---|---|
| `scheduler` | ✅ MCP `calendar` connector (`create_event`, `list_events`, `update_event`) — nếu user đã connect Google Calendar | Wire được — cần skill+connector cùng bật |
| `mailWriter` | ✅ MCP `gmail` connector (`send_email`, `create_draft`) | Wire được |
| `inboxTriage` | ✅ MCP `gmail` connector (`search_threads`, đọc mail) | Wire được |
| `projectKeeper` | ✅ MCP `notion` connector (`create_page`, `update_page`) | Wire được |
| `webSearch` | ✅ `web_search` tool có sẵn NHƯNG chưa configure (API key rỗng) | Cần user cấp API key trước, KHÔNG cần code thêm |
| `weatherForecast` | ❌ không có tool nào | Ngoài scope — cần build tool mới từ đầu nếu muốn |
| `researcher`, `dataAnalyst`, `docDrafter`, `translator`, `meetingNotes` | Không cần tool ngoài — xử lý thuần trên nội dung conversation | Giữ nguyên, không cần wire |

---

## Thiết kế fix — gate tool theo skill cho 4 skill wire được

### Vấn đề thiết kế cần quyết định trước khi code (đã tự chọn hướng hợp lý nhất, nêu rõ lý do)

Có 2 cách hiểu vai trò của skill với tool:
- **(A) Skill là điều kiện BẮT BUỘC** — dù đã connect Gmail, AI chỉ được dùng tool Gmail khi user
  cũng bật skill "Mail writer" tương ứng (thêm 1 lớp consent tường minh).
- **(B) Skill chỉ là hint hành vi, tool luôn dùng được khi đã connect connector** — giữ nguyên logic
  hiện tại (không gate), chỉ sửa để skill *khuyến khích* AI chủ động dùng tool đó nhiều hơn qua câu
  instruction, thay vì tự nó việc cấp quyền.

**Chọn (A)** vì: đúng ý nghĩa mà field `requires`/hint "Needs: Gmail" trong UI đã ngầm hứa hẹn với
user ("bật cái này + kết nối Gmail thì AI mới làm được việc này") — nếu chọn (B), user connect Gmail
1 lần là AI có full quyền gửi mail mãi mãi mà không cần bật skill gì, đi ngược lại kỳ vọng UI đang
set (khiến toggle skill trở thành placebo hoàn toàn — đúng là bug hiện tại). Trade-off của (A): thêm
1 bước setup (phải bật CẢ skill lẫn connector), nhưng đúng mental model "skill = tôi cho phép AI làm
việc NÀY", nhất quán với action-group permission đã có ở connector (`view/create/edit/delete`).

### Fix — `apps/server/ai-service/src/skills/skill-catalog.ts`

Thêm mapping skill → provider + action groups cần thiết:

```typescript
/** Skill ids that gate real tool access (provider id must match connector-service CATALOG). */
export const SKILL_TOOL_REQUIREMENTS: Readonly<Record<string, { provider: string }>> = {
  scheduler: { provider: 'calendar' },
  mailWriter: { provider: 'gmail' },
  inboxTriage: { provider: 'gmail' },
  projectKeeper: { provider: 'notion' },
};
```

### Fix — `apps/server/ai-service/src/tools/tool-registry.service.ts`

`getDefinitions(ctx)` cần nhận thêm `enabledSkillIds: string[]` trong `ToolContext` (đến từ
`SkillsService`, đã có sẵn ở `ai.service.ts`). Lọc `dynamicDefs` (MCP tools) thêm 1 bước: nếu
provider của tool nằm trong `SKILL_TOOL_REQUIREMENTS` (tức là 1 trong 4 provider: calendar/gmail/
notion) THÌ chỉ giữ lại khi skill tương ứng đang enabled; provider KHÔNG nằm trong map (vd MCP
connector khác không có skill nào yêu cầu) thì giữ nguyên logic cũ (không gate thêm).

```typescript
// Thêm hàm mới, cạnh filterByAllowedConnectors:
import { SKILL_TOOL_REQUIREMENTS } from '../skills/skill-catalog';

export function filterBySkillGate(
  tools: ToolDefinition[],
  enabledSkillIds: readonly string[],
): ToolDefinition[] {
  const enabled = new Set(enabledSkillIds);
  // Provider -> phải có ít nhất 1 skill bật khớp provider đó mới cho qua.
  const gatedProviders = new Set(
    Object.entries(SKILL_TOOL_REQUIREMENTS)
      .filter(([skillId]) => !enabled.has(skillId))
      .map(([, req]) => req.provider),
  );
  if (gatedProviders.size === 0) return tools;
  return tools.filter((t) => {
    const provider = providerOf(t.name);
    if (provider === null) return true;
    return !gatedProviders.has(provider);
  });
}

// getDefinitions(): áp dụng SAU filterByAllowedConnectors (RBAC vẫn ưu tiên cao nhất):
async getDefinitions(ctx: ToolContext): Promise<ToolDefinition[]> {
  const staticDefs: ToolDefinition[] = [ /* ...giữ nguyên... */ ];
  if (ctx.webSearchEnabled !== false && this.webSearchService.isAvailable()) {
    staticDefs.push(WebSearchTool.definition);
  }
  const dynamicDefs = await this.mcpConnector.getTools(ctx.userId);
  const rbacFiltered = filterByAllowedConnectors(dynamicDefs, ctx.allowedConnectors);
  const skillFiltered = filterBySkillGate(rbacFiltered, ctx.enabledSkillIds ?? []);
  return [...staticDefs, ...skillFiltered];
}
```

`providerOf` hiện là hàm `private`/module-level trong cùng file — export nó (bỏ giữ `function
providerOf` internal, thêm `export`) để `filterBySkillGate` dùng lại được, tránh duplicate logic.

### Fix — `ToolContext` interface (`apps/server/ai-service/src/tools/tool.interface.ts`)

Thêm field:
```typescript
export interface ToolContext {
  // ...existing fields...
  /** Skill ids currently enabled for this user (gates action-skill MCP tools). */
  enabledSkillIds?: string[];
}
```

### Fix — nơi build `ToolContext` trong `ai.service.ts`

Tìm chỗ hiện đang gọi `this.skillsService.getEnabledSkillInstructions(userId)` (dùng để build system
prompt) — cần thêm 1 method mới trả về RAW list id (không phải instruction text đã build sẵn), rồi
truyền vào `ctx.enabledSkillIds` khi gọi `toolRegistry.getDefinitions(ctx)`.

`apps/server/ai-service/src/skills/skills.service.ts` — thêm method:
```typescript
async getEnabledSkillIds(userId: string): Promise<string[]> {
  try {
    const docs = await this.skillModel.find({ userId, enabled: true }).select('skillId').lean().exec();
    return docs.map((d) => d.skillId);
  } catch (err) {
    this.logger.warn(`Skill id lookup failed for ${userId}: ${(err as Error).message}`);
    return [];
  }
}
```

(Có thể refactor `getEnabledSkillInstructions` để gọi `getEnabledSkillIds` rồi `buildSkillInstructions`
lên trên, tránh query Mongo 2 lần trong cùng 1 request — gọi 1 lần, dùng kết quả cho cả 2 việc.)

### Fix — Xử lý khi skill bật nhưng connector CHƯA connect (tránh im lặng bỏ qua)

Khi `filterBySkillGate` loại bỏ tool vì thiếu skill, KHÔNG có gì để làm thêm (đây là do thiếu skill,
không phải thiếu connector — Claude vẫn nên biết là "không có quyền", đã tự nhiên vì tool không có
trong list). Nhưng trường hợp ngược lại — skill ĐÃ bật nhưng connector CHƯA connect (tool không có
trong `dynamicDefs` từ đầu vì user chưa OAuth) — hiện Claude sẽ không biết lý do, dễ hallucinate.
Thêm vào instruction của 4 skill này 1 câu rõ ràng (sửa trong `skill-catalog.ts`):

```typescript
// scheduler — thêm cuối instruction hiện tại:
' If no calendar tool is available, tell the user to connect Google Calendar in Integrations first — never fabricate a booking.'
// mailWriter — tương tự, thêm cuối:
' If no email tool is available, tell the user to connect Gmail in Integrations first — never claim an email was sent.'
// inboxTriage — thêm cuối:
' If no email tool is available, tell the user to connect Gmail in Integrations first.'
// projectKeeper — thêm cuối:
' If no Notion tool is available, tell the user to connect Notion in Integrations first — never claim something was saved.'
```

---

## Verification

1. Unit test mới cho `filterBySkillGate` (`tool-registry.service.spec.ts` nếu có, hoặc file spec
   mới): case skill off + connector on → tool bị lọc; skill on + connector on → tool giữ; skill on +
   connector off → tool vốn dĩ không có trong `dynamicDefs`, không crash.
2. E2E thủ công: connect Google Calendar, KHÔNG bật skill Scheduler → hỏi AI "đặt lịch họp 3h chiều
   mai" → AI phải nói cần bật skill Scheduler trước (hoặc chỉ đề xuất bằng lời, KHÔNG gọi tool thật)
   → verify qua AI trace / log không thấy `mcp__calendar__create_event` được gọi.
3. Bật skill Scheduler + đã connect Calendar → hỏi lại câu trên → AI gọi tool thật, event xuất hiện
   trong Google Calendar thật.
4. `pnpm build` trong `apps/server/ai-service/` — PASS.

## Việc KHÔNG nằm trong scope plan này (cần quyết định/secret riêng, không phải code)

- **`webSearch` hoạt động thật**: cần user cấp `WEB_SEARCH_API_URL` + `WEB_SEARCH_API_KEY` (Brave/
  Tavily/SerpAPI...) trong `apps/server/ai-service/.env`, restart ai-service. Không có secret này,
  dù wire skill-gate xong, `isAvailable()` vẫn `false` → tool vẫn không đăng ký.
- **`weatherForecast` hoạt động thật**: cần build tool + provider mới hoàn toàn (không có sẵn), cần
  quyết định dùng API nào (OpenWeatherMap/WeatherAPI/...) và ai trả phí — plan riêng nếu muốn làm.
