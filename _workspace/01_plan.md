## Feature: TASK-09 — Web search tool (ai-service)

### Summary
Add a built-in `web_search` tool to ai-service's STATIC tool registry with a pluggable provider abstraction (Anthropic server-side web-search tool when enabled, else a generic search-API key à la Brave/Tavily). The tool returns titles + URLs + snippets and its results flow into the EXISTING citation path (TASK-06 `sources` field on `AI_STREAM_DONE`) so `[Source N]` chips render and are clickable on both clients. It is toggleable per workspace via config (default ON) and degrades gracefully — when no provider/key is configured the tool is simply not registered.

This is a **backend-heavy** task. chat-service relays `sources` untouched (verified — no change needed). Mobile + Web already render `sources` from TASK-06; their work here is **verification-only** plus one small affordance so a `url`-type source opens the external link instead of the KB view.

---

### Key architectural finding (read before implementing)

The `sources` array on `AI_STREAM_DONE` is built from `ctx.ragSources`, which is populated by `context-builder.service.ts` **BEFORE** the agentic loop runs (it is pre-retrieved RAG/KB context, not tool output). A `web_search` tool runs **INSIDE** the agentic loop (`_agenticLoop` in `ai.service.ts`), so its results are NOT in `ctx.ragSources`.

**Therefore the core of this task is plumbing tool-produced sources into the DONE payload.** The chosen mechanism (see Backend): a mutable per-request "source sink" passed via `ToolContext`; the web-search tool pushes `RagSource`-shaped entries into it; `_agenticLoop` merges the sink with `ctx.ragSources` (RAG sources first, web sources after, re-numbered contiguously) when publishing `AI_STREAM_DONE`. This keeps the EXISTING `[Source N]` citation contract intact — the model already emits `[Source N]` markers, and both clients already render the `sources` array.

`RagSource` is extended with two OPTIONAL fields so KB and web sources share one shape and one render path:
```ts
export interface RagSource {
  documentId: string;   // for web: a synthetic stable id, e.g. `web:<n>` (survives client dedup-by-documentId)
  fileName: string;     // for web: the page title (clients already fall back to this as the chip label)
  score: number;
  url?: string;         // NEW — present only for web sources; clients open this externally
  type?: 'kb' | 'web';  // NEW — defaults to 'kb' when absent (backward compatible)
}
```
Rationale: clients dedupe by `documentId` and label by `fileName`, so giving each web result a distinct synthetic `documentId` and the page title as `fileName` means it renders TODAY with zero client change. The only client work is making the chip open `url` (web type) instead of `/kb/{conversationId}`.

---

### Backend (ai-service — NestJS, PRIMARY)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/server/ai-service/src/tools/web-search.tool.ts` | 신규 | The tool. Static `definition` (`name: 'web_search'`, `input_schema`: `{ query: string (required), maxResults?: number }`). `execute(input, ctx)` calls the configured provider, formats results as `[Source N] <title> — <url>\n<snippet>` text (mirroring `search-knowledge-base.tool.ts`'s `[Source N]` text format so the model cites consistently), AND pushes one `RagSource` per result into `ctx.sourceSink` (`{ documentId: 'web:'+i, fileName: title, score, url, type: 'web' }`). Returns a clear "no results" string on empty/failure. Keep ≤300 lines. |
| `apps/server/ai-service/src/tools/web-search/web-search-provider.interface.ts` | 신규 | `WebSearchProvider` interface: `isConfigured(): boolean` + `search(query, maxResults): Promise<WebSearchResult[]>` where `WebSearchResult = { title, url, snippet }`. Clean abstraction so providers are swappable and the tool degrades gracefully. |
| `apps/server/ai-service/src/tools/web-search/anthropic-web-search.provider.ts` | 신규 | Provider that uses the Anthropic server-side `web_search` tool. NOTE: this is a server-tool executed by Anthropic, not a normal client tool — see "Anthropic provider note" below; if integrating it cleanly into the existing custom agentic loop is non-trivial, implement the generic-API provider first and have this provider report `isConfigured()=false` (graceful no-op) until wired. Document the decision inline. |
| `apps/server/ai-service/src/tools/web-search/generic-search.provider.ts` | 신규 | Provider hitting a generic search API (Brave/Tavily-style) via the configured `WEB_SEARCH_API_KEY` + `WEB_SEARCH_API_URL`. `isConfigured()` returns true only when a key is present. Use the project's HTTP approach (check `mcp-connector.client.ts` for the axios/HttpService convention). try/catch all network calls; on error return `[]` and log via Nest `Logger` (never throw out of the tool). |
| `apps/server/ai-service/src/tools/web-search/web-search.service.ts` | 신규 | Thin selector: picks the active provider (Anthropic if enabled+configured, else generic if key present, else none). Exposes `isAvailable()` (true iff web search is enabled in config AND some provider `isConfigured()`) and `search()`. The tool + registry depend on this, not on providers directly. |
| `apps/server/ai-service/src/tools/tool-registry.service.ts` | 수정 | Inject `WebSearchTool` + `WebSearchService`. In `getDefinitions`, conditionally append `WebSearchTool.definition` to `staticDefs` ONLY when `webSearchService.isAvailable()` (graceful: not registered when off/unconfigured). Add `case 'web_search': return this.webSearch.execute(input, ctx);` to `dispatch`. `web_search` is read-only → leave it OUT of the sensitive set so result caching still applies (verify `isSensitiveTool('web_search')` is false). |
| `apps/server/ai-service/src/tools/tool.interface.ts` | 수정 | Extend `ToolContext` with `sourceSink?: RagSource[]` (optional, mutable array the loop creates per request and tools push into). Import the `RagSource` type — if importing from `context-builder.service.ts` creates a circular import, move `RagSource` to a small shared type file (e.g. `ai/rag-source.type.ts`) and re-export; check before deciding. |
| `apps/server/ai-service/src/ai/context-builder.service.ts` | 수정 | Add optional `url?: string` and `type?: 'kb' \| 'web'` to the `RagSource` interface. KB sources set neither (default `type` treated as `'kb'`). No behavior change to RAG. |
| `apps/server/ai-service/src/ai/ai.service.ts` | 수정 | (1) In `_agenticLoop`, create `const sourceSink: RagSource[] = []` and put it on `toolCtx.sourceSink`. (2) When publishing `AI_STREAM_DONE`, send `sources: mergeSources(ctx.ragSources, sourceSink)` — RAG first, then web, de-duped, contiguous order matching the `[Source N]` the model emitted. (3) IMPORTANT: the cache-eligibility guard must also exclude answers that produced web sources (web results are non-deterministic/time-sensitive) — extend the existing `toolCalls.length === 0 && ctx.ragSources.length === 0` condition to also require `sourceSink.length === 0`. |
| `apps/server/ai-service/src/tools/tools.module.ts` | 수정 | Register `WebSearchTool`, `WebSearchService`, both providers as providers. Ensure `HttpModule` (if used) is imported. |
| `apps/server/ai-service/src/config/configuration.ts` | 수정 | Add a `webSearch` block following the existing env-var convention (mirror `KB_HYBRID_ENABLED` / `AI_RATE_LIMIT_ENABLED` default-on style): `enabled: process.env.WEB_SEARCH_ENABLED !== 'false'` (default ON), `provider: process.env.WEB_SEARCH_PROVIDER ?? 'anthropic'` (`'anthropic' \| 'generic'`), `apiKey: process.env.WEB_SEARCH_API_KEY`, `apiUrl: process.env.WEB_SEARCH_API_URL`, `maxResults: parseInt(process.env.WEB_SEARCH_MAX_RESULTS ?? '5', 10)`. |
| `apps/server/ai-service/src/tools/web-search.tool.spec.ts` | 신규 | Unit tests: tool formats `[Source N]` text + pushes correct `RagSource` entries into the sink; empty/failed provider → "no results" string and empty sink; provider network error is swallowed (no throw). Mock the provider — NEVER hit a real API. Follow the existing tool/service test pattern (check `reranker.service.spec.ts` or another `*.spec.ts` for the harness). |
| `apps/server/ai-service/.env` + `.env.example` (if present) | 수정 | Document the new `WEB_SEARCH_*` env vars. Do NOT commit a real key. |

**Anthropic provider note:** Anthropic exposes web search as a *server-side tool* (the model calls it and Anthropic executes it within the same `messages` request), which is a different execution model from this service's custom in-loop tool dispatch. Two valid integration shapes — pick the simpler that fits the existing loop and record the choice in the file header:
  (a) Treat `web_search` uniformly as a custom tool backed by the generic search API provider (works for both `provider=generic` and as the Anthropic-fallback). Simplest; keeps one citation path. **Recommended default.**
  (b) Pass Anthropic's server `web_search` tool spec through `buildTools` when `provider=anthropic`, and harvest `web_search_tool_result` / citation blocks from the stream into the source sink. More faithful to "Anthropic web search" but touches the stream-parsing in `_agenticLoop`. Only do this if (a) is insufficient.
If unsure which Anthropic server-tool type id/shape is current, the implementer should consult the `claude-api` skill before wiring (b) rather than guessing.

**Build/test gate (ai-service):** `pnpm build && pnpm test` must be green (existing ~138 tests + new web-search tests). Verify the tool is NOT registered when `WEB_SEARCH_ENABLED=false` or no key, and IS registered when configured.

---

### Mobile (Flutter) — VERIFICATION-ONLY + one small affordance

Citation rendering already exists (TASK-06). Do NOT build a feature. Concrete checks:

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/chat/domain/chat_models.dart` | 수정 (small) | `AiSource` parser (around line 280–305): add optional `final String? url;` and `final String type;` (default `'kb'`); parse `raw['url']` and `raw['type']` when the entry is a map. Backward compatible — bare-string and KB payloads unaffected. |
| `apps/client/lib/features/chat/ui/widgets/streaming_ai_bubble.dart` | 수정 (small) | In `_SourceChipsRow` (line ~298–306): when `s.url != null && s.url!.isNotEmpty` (web source), set `onTap` to open the URL externally (`url_launcher` `launchUrl` — confirm the package is already a dependency; if not, reuse any existing link-open helper rather than adding a dep) instead of `context.push('/kb/$conversationId')`. KB sources keep the existing `/kb/...` behavior. Optionally show a small globe/link icon on web chips. |
| `apps/client/lib/l10n/app_*.arb` (×7) | 수정 (only if a new string is added) | `sourcesLabel` already exists and is reused. Only add a key if a distinct web-source label/tooltip is introduced; otherwise NO i18n change. Follow `.claude/rules/i18n.md`: add to all 7 + `flutter gen-l10n`. |

**Verification checklist (mobile):**
- [ ] An `AI_STREAM_DONE` payload containing a `type:'web'` source with a `url` renders a clickable chip whose label is the page title (`fileName`).
- [ ] Tapping a web chip opens the URL; tapping a KB chip still opens `/kb/{conversationId}`.
- [ ] Mixed answers (KB + web sources) render all chips, de-duped, no crash; legacy KB-only payloads unchanged.
- [ ] `flutter analyze` clean.

---

### Web (Next.js) — VERIFICATION-ONLY + one small affordance

Citation rendering already exists (TASK-06). Do NOT build a feature. Concrete checks:

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/lib/api/types.ts` | 수정 (small) | Extend `AiSource` (line ~92): add `url?: string` and `type?: 'kb' \| 'web'`. Keep existing fields. `strict` TS — no `any`. |
| `apps/web/components/chat/MessageSources.tsx` | 수정 (small) | In the chip render (line ~50–58): when `s.url` is present (web source), render an external `<a href={s.url} target="_blank" rel="noopener noreferrer">` (or `<Link>`) instead of the `/kb/{conversationId}` link; label stays `s.fileName \|\| fallbackLabel`. Optionally swap the `BookOpen` icon for a `Globe`/`ExternalLink` lucide icon on web chips. KB chips unchanged. |
| `apps/web/messages/*.json` | 수정 (only if a new string is added) | `sourcesLabel` already exists and is reused. Add a key only if a distinct web-source label/tooltip is introduced; otherwise NO i18n change. If added, add to all locale files. |

**Verification checklist (web):**
- [ ] An `AI_STREAM_DONE` source with `type:'web'` + `url` renders a chip that opens the URL in a new tab; KB chips still navigate to `/kb/{conversationId}`.
- [ ] Mixed KB + web sources render correctly, de-duped by `documentId` (web ids are distinct `web:N`), no console errors.
- [ ] Legacy KB-only payloads unchanged.
- [ ] `pnpm build` (web) passes (TS strict).

---

### chat-service (Spring Boot) — NO CHANGE, verify only

`AiResponseListener.java` (`deliverToStomp`, `AI_STREAM_DONE` branch, lines ~140–144) forwards `sources` **untouched** via `objectMapper` pass-through: `doneEvent.put("sources", sources != null ? sources : List.of())`. The `sources` value is handled as a plain `Object`, so the new optional `url`/`type` fields on each source object pass through transparently — **no Java change required.** Verification: `mvn compile` (or existing `mvn test`) stays green; confirm by inspecting the DONE branch that `sources` is not deserialized into a typed DTO that would drop unknown fields (it is not — it is forwarded as `Object`).

---

### API Contract

No new REST endpoint. The contract change is on the existing STOMP relay event.

**Event:** `AI_STREAM_DONE` on `/topic/conversation/{id}` (published by ai-service → Redis → chat-service → STOMP)
- Existing: `{ type, conversationId, senderId, fullContent, trace, sources: AiSource[] }`
- `AiSource` (extended, additive/backward-compatible):
  ```
  { documentId: string, fileName: string, score: number, url?: string, type?: 'kb' | 'web' }
  ```
- Web-source entries: `documentId = "web:<index>"`, `fileName = <page title>`, `url = <result url>`, `type = "web"`.

**Tool I/O (internal to ai-service agentic loop):**
- `web_search` input: `{ query: string (required), maxResults?: number }`
- `web_search` tool-result text (consumed by the model): `"[Source N] <title> — <url>\n<snippet>"` blocks, mirroring the KB tool's `[Source N]` format so the model cites web results identically.

---

### Data Model Changes
없음. No new MongoDB collection or schema. Web search is stateless (no persistence; results are not stored). `RagSource`/`AiSource` gains two OPTIONAL fields only.

---

### Implementation Order
1. **Backend (ai-service)** — primary, do first and complete fully:
   - configuration.ts (`webSearch` block) → provider interface + generic provider + (anthropic provider stub) → web-search.service.ts → web-search.tool.ts → extend `RagSource`/`ToolContext` with `url`/`type`/`sourceSink` → wire `tool-registry.service.ts` + `tools.module.ts` → merge sink in `ai.service.ts` `_agenticLoop` DONE payload + cache guard → tests. Gate: `pnpm build && pnpm test` green.
2. **Mobile + Web** — can run in PARALLEL after the API contract above is fixed (it is fixed in this plan, so they may start immediately, in parallel with backend). Each is small: extend the source type with `url`/`type`, make the chip open the URL for web sources. Gates: `flutter analyze` / web `pnpm build`.
3. chat-service: verify-only (`mvn compile`), no code change.

Per `.claude/rules/sync.md`: the web-source chip affordance MUST land on BOTH web and Flutter, or it is considered broken.

---

### Edge Cases
- **No provider/key configured** → `WebSearchService.isAvailable()` is false → tool not registered → loop behaves exactly as today. (Acceptance: graceful degradation.)
- **`WEB_SEARCH_ENABLED=false`** → tool not registered even if a key exists (per-workspace toggle; default ON).
- **Provider network error / timeout / non-200** → tool returns a clear "couldn't search the web right now" string and pushes nothing into the sink; never throws out of the loop (would otherwise dead-letter the request). Wrap with try/catch + Nest `Logger`.
- **Empty results** → return a "no results found" string; empty sink; model answers from its own knowledge or says it couldn't find current info.
- **`[Source N]` numbering collision between KB and web** → `_agenticLoop` must merge sources in a single contiguous order (RAG first, then web) so the numbers the model emitted line up with the merged `sources` array. Document the ordering assumption next to `mergeSources`.
- **Client dedup-by-documentId** → web sources use distinct synthetic ids (`web:0`, `web:1`, …) so multiple web results don't collapse into one chip.
- **Result caching** — `web_search` is read-only so the tool-result cache (`ToolResultCacheService`) may cache it briefly (per the existing short-TTL, per-user policy); acceptable. BUT the semantic *response* cache must NOT store an answer that used web search → extend the cache-eligibility guard in `_agenticLoop` to require `sourceSink.length === 0` (alongside `toolCalls.length === 0`).
- **Sensitive-tool set** — `web_search` must NOT be flagged sensitive (it is read-only, no confirmation prompt); verify `isSensitiveTool('web_search') === false`.
- **Prompt-injection (TASK-02)** — web results are untrusted external content; fence the snippet text with the existing `wrapUntrusted` spotlighting helper used for KB chunks so a malicious page cannot inject instructions. (Recommended; low cost — reuse `injection-guard`'s `wrapUntrusted`/`sanitizeUntrusted`.)
- **i18n** — only add new keys if a distinct web-source string is introduced; `sourcesLabel` is reused. If added, all 7 Flutter ARBs + all web locale JSONs.
