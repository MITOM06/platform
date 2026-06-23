## QA Report — TASK-09 Web Search Tool (ai-service) — 2026-06-23

### Verdict: **PASS**

Web search tool implemented backend-heavy with graceful degradation; both clients (web + Flutter) parse `url`/`type` and open `type:'web'` chips externally. All four build/test gates green. chat-service required no Java change. Cross-platform parity (sync.md) has landed on BOTH platforms — the concern mobile-dev raised (web side not yet done at the time) is now resolved.

---

### Build / Test Status (commands run by QA, exact results)

| Gate | Command | Result |
|------|---------|--------|
| ai-service build | `pnpm --filter ai-service build` | ✓ PASS — exit 0, `nest build`, no errors |
| ai-service test | `pnpm --filter ai-service test` | ✓ PASS — **Test Suites: 26 passed, 26 total; Tests: 207 passed, 207 total** |
| web build | `pnpm --filter @platform/web build` | ✓ PASS — exit 0, all routes compiled, no TS errors (strict type-check runs in build) |
| flutter analyze | `cd apps/client && flutter analyze` | ✓ PASS — exit 0, `No issues found! (ran in 3.5s)` |

New tests confirmed present and green: `src/tools/web-search.tool.spec.ts`, `src/tools/web-search/web-search.service.spec.ts`, `src/ai/merge-sources.spec.ts`.

Only environment warnings on builds (pnpm config field deprecation, node engine, `module.register`) — none attributable to this change.

---

### API Contract Integrity

`AI_STREAM_DONE` `sources: AiSource[]` extended additively (backward-compatible):
```
{ documentId: string, fileName: string, score: number, url?: string, type?: 'kb' | 'web' }
```
Web entries: `documentId="web:<index>"`, `fileName=<page title>`, `url=<result url>`, `type="web"`.

- [x] plan.md contract == backend emit — `mergeSources(ctx.ragSources, sourceSink)` at `ai.service.ts:538`; web sources pushed as `{documentId:'web:N', fileName:title, url, type:'web'}` (per backend report + tool spec).
- [x] Web TS type matches — `apps/web/lib/api/types.ts:92-101` adds `url?: string` + `type?: 'kb' | 'web'`, no `any`, strict preserved.
- [x] Flutter Dart type matches — `chat_models.dart:280-324`: `AiSource` adds `final String? url`, `final String type` (default `'kb'`), `bool get isWeb`, and `tryParse` reads `raw['url']`/`raw['type']` (map entries) while staying back-compat with bare-string + legacy KB payloads.

---

### Cross-Platform Sync (.claude/rules/sync.md) — the critical check

Mirror files `MessageSources.tsx` ↔ `streaming_ai_bubble.dart` `_SourceChipsRow` — affordance verified on BOTH, by reading the actual code:

| Behavior | Web (`MessageSources.tsx`) | Flutter (`streaming_ai_bubble.dart`) | Match |
|----------|----------------------------|--------------------------------------|-------|
| Detect web source | `isWeb = (s.type==='web' \|\| !!s.url) && !!s.url?.trim()` (L46) | `s.isWeb` = `type=='web' \|\| (url!=null && url.isNotEmpty)` | ✓ identical rule |
| Open web chip externally | `<a href={s.url} target="_blank" rel="noopener noreferrer">` (L60-72) | `launchUrl(uri, mode: LaunchMode.externalApplication)` via `_openExternal(s.url!)` (L313-314) | ✓ external, NOT /kb |
| KB chip behavior | keeps `next/link` → `/kb/{conversationId}` (L74-77) | keeps `context.push('/kb/$conversationId')` (L315-316) | ✓ unchanged |
| Web-source icon | `Globe` (lucide) | `Icons.public` (globe) | ✓ |
| Dedup by documentId | `Map` keyed by documentId (L29) | `deduped` by documentId | ✓ distinct `web:N` survive |

- [x] Parity actually landed on both. Mobile-dev's earlier note ("web side not yet done") is resolved — web `types.ts` + `MessageSources.tsx` now carry the fields and the external-open affordance.
- [x] i18n: no new user-facing string introduced (`sourcesLabel` reused; globe is non-textual) → no ARB / messages.json change required, consistent across both platforms. Correct per i18n.md.

---

### Graceful Degradation (verified in source)

- [x] Tool NOT registered unless available: `tool-registry.service.ts:40` — `if (this.webSearchService.isAvailable()) staticDefs.push(WebSearchTool.definition)`.
- [x] `isAvailable() = enabled && provider.isConfigured()` (`web-search.service.ts:48-50`). No key/URL ⇒ generic provider `isConfigured()` false ⇒ tool not offered ⇒ loop behaves byte-identically to today.
- [x] Default-on out of the box behaves sanely: `WEB_SEARCH_ENABLED !== 'false'` (default true) BUT `WEB_SEARCH_PROVIDER` default is **`generic`** (configuration.ts:128-135). Default generic + no key ⇒ not configured ⇒ not registered. So "default ON" never registers a broken tool. (Note the plan suggested default `anthropic`; backend deliberately changed it to `generic` because the anthropic provider is a documented no-op stub — this is the correct call, otherwise `isAvailable()` would always be false and the feature dead even when a key is set.)
- [x] `web_search` not in sensitive set (read-only) — verified by `merge-sources.spec.ts` assertion `isSensitiveTool('web_search') === false` (passing).
- [x] Response-cache guard extended: `ai.service.ts:547` requires `sourceSink.length === 0` so time-sensitive web answers are never cached.

### chat-service Pass-Through (verified — NO Java change)

- [x] `git diff --stat HEAD -- apps/server/chat-service/` → **empty** (zero changes).
- [x] `AiResponseListener.java:143-144` reads `Object sources = payload.get("sources")` and forwards via `doneEvent.put("sources", sources != null ? sources : List.of())` — untyped `Object`, so new optional `url`/`type` fields pass through transparently. No typed DTO drops unknown fields.

### Acceptance Criterion

A question needing current info → model calls `web_search` (when available) → tool returns `[Source N] <title> — <url>` text (mirroring KB tool format, snippets fenced via `wrapUntrusted` for prompt-injection safety) AND pushes RagSource entries into the sink → merged into `AI_STREAM_DONE.sources` → existing `[Source N]` chip mechanism renders clickable cited sources on both clients. Mechanism is structurally complete and unit-tested with mocked provider. **Met (pending a live provider key — see owner action).**

---

### Issues Found

| Severity | File:Line | Issue | Recommendation |
|----------|-----------|-------|----------------|
| Info (non-blocking) | configuration.ts:132 | Default `WEB_SEARCH_PROVIDER=generic` deviates from plan's `anthropic` | Intentional + correct; documented in backend report. No action. |
| Info (non-blocking) | web/Flutter chip | A source with `type:'web'` but empty `url` falls back to KB-link behavior on both platforms | Safe degradation (cannot open empty URL); identical on both — acceptable. |

No P1/P2 issues. No cross-platform mismatch.

---

### OWNER ACTION REQUIRED to activate web search in production

Web search ships **OFF in practice** until a generic provider is configured (graceful gate). To turn it on, set on **ai-service** (the only service that needs it — chat-service unaffected):

| Env var | Value to set | Notes |
|---------|--------------|-------|
| `WEB_SEARCH_PROVIDER` | `generic` | Already the default; keep as-is. |
| `WEB_SEARCH_API_URL` | Brave/Tavily-style search API endpoint | Required — no URL ⇒ not configured. |
| `WEB_SEARCH_API_KEY` | the search-API key (secret) | **Required** — this is the switch that flips `isAvailable()` true and registers the tool. Store as a secret, do NOT commit. |
| `WEB_SEARCH_MAX_RESULTS` | optional, default `5` (tool caps at 10) | |
| `WEB_SEARCH_ENABLED` | leave unset/`true`; set `false` to hard-disable | per-workspace toggle |

Until `WEB_SEARCH_API_KEY` + `WEB_SEARCH_API_URL` are set on ai-service, behavior is identical to pre-TASK-09 (tool simply absent). The `anthropic` provider value remains a no-op stub and will NOT activate web search.

Reminder per CLAUDE.md prod notes: ai-service must run with `--no-cpu-throttling` (+min-instances=1) for its RabbitMQ consumer to stay alive — unrelated to this task but required for any AI feature to work in prod.
