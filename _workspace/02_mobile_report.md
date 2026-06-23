## Mobile Implementation Report — TASK-09 (Web search sources)

Scope per plan: VERIFICATION-ONLY + one small affordance. Citation rendering
already exists from TASK-06; no new feature was built.

### 검증한 내용 (Verification)

- **`AiSource` parser** (`chat_models.dart`, `tryParse`): confirmed it already
  parses `{documentId, fileName, score}` maps AND bare documentId strings
  (backward compatible). Extended it (see below) to also read the new optional
  `url` / `type` fields from the TASK-09 contract.
- **`_SourceChipsRow`** (`streaming_ai_bubble.dart`): confirmed it already
  renders one chip per source, de-duped by `documentId`, labelled by
  `fileName` (with a leading-8-chars fallback). A synthetic `documentId="web:N"`
  + `fileName=<title>` web source therefore renders TODAY as a distinct chip
  with the page title as its label — no structural change needed.
- **chat-service pass-through**: not in mobile scope; plan confirms it forwards
  `sources` as an untyped `Object`, so the new `url`/`type` fields reach the
  client transparently. Client parser tolerates their absence.

### 변경된 파일 (Changed files)

- `/Users/phong/projects/personal/platform/apps/client/lib/features/chat/domain/chat_models.dart`
  — `AiSource`: added optional `final String? url` and `final String type`
  (default `'kb'`); added `bool get isWeb` (true when `type=='web'` or a
  non-empty `url`); `tryParse` now reads `raw['url']` and `raw['type']` from map
  entries. Bare-string and legacy KB payloads are unaffected (defaults applied).
- `/Users/phong/projects/personal/platform/apps/client/lib/features/chat/ui/widgets/streaming_ai_bubble.dart`
  — imported `url_launcher`; `_SourceChipsRow` now routes the chip `onTap`:
  web sources (`s.isWeb`) open `s.url` externally via
  `launchUrl(uri, mode: LaunchMode.externalApplication)` (the existing
  external-link pattern used across the app); KB sources keep the unchanged
  `context.push('/kb/$conversationId')` behaviour. `_SourceChip` gained an
  `isWeb` flag and shows `Icons.public` (globe) for web chips vs
  `Icons.description_outlined` for KB chips.

### flutter analyze 결과

- Changed files only: **No issues found** (0).
- Full `apps/client` project: **No issues found** (0). issues: 0.

### i18n 추가 키

- None. The existing `sourcesLabel` key is reused per the plan; no distinct
  web-source string was introduced, so no ARB changes and no `flutter gen-l10n`
  were required.

### Web ↔ Mobile parity (.claude/rules/sync.md)

- The affordance contract (web sources open their `url` externally; KB sources
  navigate to the KB view) is now implemented on mobile.
- Mirror file `apps/web/components/chat/MessageSources.tsx` currently still
  navigates ALL chips to `/kb/{conversationId}` and `apps/web/lib/api/types.ts`
  `AiSource` does not yet carry `url`/`type`. Per the plan these are the
  web-dev's small affordance (open `url` in a new tab + extend the type). Mobile
  matches the INTENDED shared contract; once the web change lands, both
  platforms open web-source URLs and keep KB chips on `/kb/{id}`, achieving
  full parity.

### 주의사항 (Notes)

- Web-source de-dup relies on distinct synthetic `documentId` values
  (`web:0`, `web:1`, …) from the backend — verified the client dedups by
  `documentId`, so multiple web results render as separate chips (do not
  collapse).
- `isWeb` intentionally also treats any source with a non-empty `url` as web,
  so even if the backend omits `type` but supplies a `url`, the chip still opens
  externally — defensive against minor contract drift.
- Mixed KB + web answers render all chips with no crash; legacy KB-only payloads
  are byte-for-byte unchanged in behaviour.
