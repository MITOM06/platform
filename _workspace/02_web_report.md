## Web Implementation Report — TASK-09 (Web search source affordance)

### What I verified
- `apps/web/components/chat/MessageSources.tsx` already renders the `sources` array from TASK-06: de-dupes by `documentId`, labels each chip by `s.fileName` (falling back to `#<id-prefix>`), and is keyed by `documentId`. Web-search sources carry distinct synthetic `documentId="web:N"`, so they survive the dedup-by-documentId step and each render as its own chip. `fileName=<title>` already drives the chip label — so web sources render correctly TODAY with no further change to labeling/dedup.
- `AiSource` was defined in `apps/web/lib/api/types.ts` (line 92) with only `documentId/fileName/score`, and is used by the `AI_STREAM_DONE` STOMP event type (line 185) and `Message.sources` (line 118).
- `sourcesLabel` already exists in `apps/web/messages/*.json` and is reused — no new user-facing string is introduced (the globe icon is non-textual), so per `.claude/rules/sync.md` NO i18n change is required.

### What I changed
1. `apps/web/lib/api/types.ts` — extended `AiSource` with two optional, backward-compatible fields matching the backend contract:
   - `url?: string` (external page URL, web sources only)
   - `type?: 'kb' | 'web'` (defaults to `'kb'` when absent)
   No `any`; strict TS preserved.
2. `apps/web/components/chat/MessageSources.tsx` — added the one affordance:
   - A source is treated as a web source when `(s.type === 'web' || s.url)` AND it has a non-empty `url`.
   - Web chips render as `<a href={s.url} target="_blank" rel="noopener noreferrer">` (open in new tab) instead of the `next/link` `/kb/{conversationId}` navigation.
   - Web chips show a `Globe` lucide icon (KB chips unchanged).
   - KB-doc behavior unchanged: non-web sources keep the existing `/kb/{conversationId}` `<Link>` (or non-interactive `<span>` if no `conversationId`).

### Files touched
- `/Users/phong/projects/personal/platform/apps/web/lib/api/types.ts`
- `/Users/phong/projects/personal/platform/apps/web/components/chat/MessageSources.tsx`

### Build result
- `pnpm --filter @platform/web build` → **PASS**. `✓ Compiled successfully in 2.8s`, all routes built, no TypeScript errors (Next.js build runs type-checking). Only unrelated environment warnings (pnpm config field deprecation, node engine, `module.register` deprecation) — none from this change.
- TypeScript type-check errors attributable to this change: **0**.

### i18n added keys
- None. `sourcesLabel` reused; the affordance adds only a non-textual `Globe` icon.

### Flutter ↔ Web affordance match (sync.md)
- Contract field parity: web `AiSource` now has `url?: string` + `type?: 'kb' | 'web'`, matching the planned Flutter `AiSource` (`String? url`, `String type = 'kb'`) and the `AI_STREAM_DONE` contract `{ documentId, fileName, score, url?, type? }`.
- Behavior parity: web source chip opens `url` externally (new tab, `rel="noopener noreferrer"`); KB chip keeps `/kb/{conversationId}`. Mirrors the planned Flutter behavior (web chip → `launchUrl`, KB chip → `context.push('/kb/$conversationId')`).
- `MessageSources.tsx` ↔ `streaming_ai_bubble.dart` `_SourceChipsRow`: affordance matches. ✓ (web side complete; Flutter side handled by mobile-dev per the plan).

### Notes / caveats
- A source is classified as web only when it has a non-empty `url`. If a payload sets `type:'web'` but no `url`, it falls back to KB-link behavior — safe degradation (cannot open an empty URL).
- No backend or chat-service change here (verify-only on those per the plan).
