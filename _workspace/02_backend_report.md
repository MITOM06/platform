## Backend Implementation Report — TASK-09 Web Search Tool (ai-service)

### What was built
A built-in `web_search` tool for ai-service's static tool registry, with a pluggable provider
abstraction and graceful degradation. Tool-produced web results now flow into the existing
TASK-06 citation path (`sources` on `AI_STREAM_DONE`) via a new per-request **source sink**
plumbed through `ToolContext`. KB + web sources share one `RagSource` shape and one render path.

Integration choice: **option (a)** from the plan — `web_search` is a normal custom tool backed by a
generic search-API provider (one citation path). The Anthropic server-side provider is a
**documented no-op stub** (`isConfigured()=false`) because it is a server-tool with a different
execution model than this service's custom in-loop dispatch; wiring it (option b) would require
changing the stream parser in `_agenticLoop`. Decision is documented in the provider file header.

One deviation from the plan worth noting: the config default `WEB_SEARCH_PROVIDER` is **`generic`**
(plan suggested `anthropic`). Rationale: the recommended default path is the generic custom tool;
defaulting to the no-op anthropic stub would make `isAvailable()` false out of the box, contradicting
"default ON". With `generic` default it is still graceful — no key ⇒ not configured ⇒ not registered.

### Files changed / created
**New:**
- `apps/server/ai-service/src/tools/web-search.tool.ts` — the tool. Static `web_search` definition,
  `execute()` formats `[Source N] <title> — <url>\n<snippet>` (fenced via `wrapUntrusted`) AND pushes
  one `RagSource` per result into `ctx.sourceSink` (`web:<i>` id, title as fileName, url, type:'web').
  Never throws; clear strings on empty/error.
- `apps/server/ai-service/src/tools/web-search/web-search-provider.interface.ts` — `WebSearchProvider`
  (`name`, `isConfigured()`, `search()`) + `WebSearchResult` ({title,url,snippet}).
- `apps/server/ai-service/src/tools/web-search/generic-search.provider.ts` — Brave/Tavily-style provider
  via native `fetch` (project convention from `mcp-connector.client.ts`), 8s timeout, normalizes common
  response shapes, try/catch → `[]` + `Logger.warn` (never throws).
- `apps/server/ai-service/src/tools/web-search/anthropic-web-search.provider.ts` — documented no-op stub.
- `apps/server/ai-service/src/tools/web-search/web-search.service.ts` — selector. `isAvailable()` =
  enabled AND selected provider configured; `search()`; `defaultMaxResults`.
- `apps/server/ai-service/src/ai/rag-source.type.ts` — shared `RagSource` (with new optional `url`,
  `type`) extracted so tools layer + context-builder share it without a circular import.
- `apps/server/ai-service/src/tools/web-search.tool.spec.ts` — 7 unit tests (format, sink entries,
  no-results, empty query, error swallowed, maxResults cap/default). Provider mocked, no real API.
- `apps/server/ai-service/src/tools/web-search/web-search.service.spec.ts` — 6 tests (availability gating).
- `apps/server/ai-service/src/ai/merge-sources.spec.ts` — 5 tests (RAG-first/web-after ordering, dedup,
  distinct web ids, `isSensitiveTool('web_search') === false`).

**Modified:**
- `tools/tool.interface.ts` — `ToolContext.sourceSink?: RagSource[]` (imports shared RagSource).
- `ai/context-builder.service.ts` — `RagSource` now imported + re-exported from the shared module
  (back-compat); no RAG behavior change.
- `tools/tool-registry.service.ts` — inject `WebSearchTool` + `WebSearchService`; conditionally append
  `web_search` to static defs only when `webSearchService.isAvailable()`; `case 'web_search'` in dispatch.
- `tools/tools.module.ts` — registered `WebSearchTool`, `WebSearchService`, both providers (no HttpModule
  needed — native fetch).
- `ai/ai.service.ts` — create `sourceSink` per request, put on `toolCtx`; `AI_STREAM_DONE` now sends
  `mergeSources(ctx.ragSources, sourceSink)`; response-cache guard extended to require `sourceSink.length === 0`.
  Added exported `mergeSources()` helper (RAG first, web after, dedup by documentId).
- `config/configuration.ts` — new `webSearch` block (enabled / provider / apiKey / apiUrl / maxResults).
- `tools/tool-registry.service.spec.ts` — updated `makeRegistry` for the 2 new ctor args; +3 tests for the gate + dispatch.
- `.env` + `.env.example` — documented `WEB_SEARCH_*` vars (no real key committed).

### Env vars added
| Var | Default | Meaning |
|-----|---------|---------|
| `WEB_SEARCH_ENABLED` | `true` (on unless `=false`) | Per-workspace toggle |
| `WEB_SEARCH_PROVIDER` | `generic` | `generic` \| `anthropic` (anthropic = no-op stub) |
| `WEB_SEARCH_API_URL` | (unset) | Generic search API endpoint |
| `WEB_SEARCH_API_KEY` | (unset) | Generic search API key — **no provider/key ⇒ tool not registered** |
| `WEB_SEARCH_MAX_RESULTS` | `5` | Default results per search (tool caps requests at 10) |

### Build / test results
- `pnpm --filter ai-service build` — PASS (nest build, no errors)
- `pnpm --filter ai-service test` — PASS — **Test Suites: 26 passed, 26 total; Tests: 207 passed, 207 total**
  (was ~194; +13 new web-search/merge/registry tests)
- chat-service — **no change** (verify-only). `AiResponseListener.java:143-144` reads `sources` as a plain
  `Object` and forwards untouched, so new optional `url`/`type` fields pass through transparently.

### API contract (for QA + clients)
`AI_STREAM_DONE` `sources: AiSource[]` is extended additively/backward-compatibly:
```
{ documentId: string, fileName: string, score: number, url?: string, type?: 'kb' | 'web' }
```
- Web entries: `documentId = "web:<index>"`, `fileName = <page title>`, `url = <result url>`, `type = "web"`.
- KB entries unchanged (no `url`, no `type` ⇒ treated as `'kb'`).
- Merge order in DONE: **RAG/KB sources first, then web sources**, contiguous, de-duped by `documentId`
  — so the `[Source N]` markers the model emits line up with the rendered chip order.

### Things QA / clients must know
- **Web search is OFF in practice until a generic key+URL is configured** (`isAvailable()` gates
  registration). With no key, behavior is byte-identical to today — verify graceful degradation.
- To exercise it end-to-end QA must set `WEB_SEARCH_PROVIDER=generic` + a real `WEB_SEARCH_API_URL`/`KEY`,
  or mock the provider. The unit tests do NOT hit any real API.
- `web_search` is **NOT sensitive** (read-only) — no confirmation prompt; tool-result cache may briefly
  cache it. The **semantic response cache will NOT store** answers that used web search (sink-length guard),
  since web results are time-sensitive.
- **Client work remaining** (per plan, both platforms or it's broken): make a `type:'web'` chip open `url`
  externally instead of `/kb/{conversationId}`, and add `url`/`type` to the client `AiSource` types.
  Flutter: `chat_models.dart` + `streaming_ai_bubble.dart`. Web: `lib/api/types.ts` + `MessageSources.tsx`.
- Web snippets are fenced with `wrapUntrusted` (prompt-injection spotlighting) before reaching the model.
