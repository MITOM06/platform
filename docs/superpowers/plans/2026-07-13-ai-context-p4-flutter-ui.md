# AI Context — P4: Flutter UI (mobile) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror the P3 web "AI Context" experience on Flutter: rename the "AI Memory" screen to **"AI Context"** with the same four sections (identity/org read-only, self-editable response style with an Update button, learned facts, role-filtered company/department context) and add the admin/manager editors (per-member hard fields + company/department context entries) — wired to the same auth-service `/ai-context/*` API and the aggregated `/api/ai/memories` endpoint.

**Architecture:** Structured context via **authDio** (port 3001, `/ai-context/*`); learned facts via **chatDio** (port 8080, `/api/ai/memories`, now a single aggregate object — P2b). Current user's role/perms/departments come from the existing `capabilitiesProvider` (`GET /me/capabilities`) + `Cap.*` keys. Admin editors extend the existing `members_panel.dart` (per-row dialog) and `admin_screen.dart` section registry. The P3 backend enrichment (`GET /ai-context/me` → `identity {role, departmentNames}`) is assumed already merged (P3 Task 1). Data/domain/ui split + Riverpod `AsyncNotifier` per the existing `admin` feature.

**Tech Stack:** Flutter 3.44 / Riverpod / Dio / go_router / Material 3 (Pon* widgets), ARB i18n (7 locales), `flutter test`, `flutter analyze`, `flutter gen-l10n`.

## Global Constraints

- Verify after changes: `cd apps/client && flutter analyze` (clean) + `flutter test` (green). After ARB edits: `flutter gen-l10n` (never hand-edit `app_localizations*.dart`).
- **i18n mandatory:** no hardcoded UI strings — always `context.l10n.<key>`. Add every new key to ALL 7 `lib/l10n/app_*.arb` (template `app_en.arb` first, with `@key` metadata for placeholders). Missing keys fall back to English but add to all 7.
- Feature layout `lib/features/<name>/{data,domain,ui}/`; business logic in providers/notifiers, never widgets. `ConsumerWidget`/`ConsumerStatefulWidget`. `AsyncValue.when(data/loading/error)` — never empty error case. go_router only (`context.go`/`context.push`), no `Navigator.push`. Max 400 lines/file.
- Theme: real colors are `AppTheme.ponCyan`/`ponPeach`/`ponPink` (+ `ponGradient`, `darkSurface`, etc.) — the `Neon*` names do NOT exist. Shared widgets: `PonCard`, `PonButton`, `PonTextField` from `lib/core/widgets/pon_widgets.dart`. Reusable admin AI controls: `AiSectionTitle`, `AiMutedText`, `AiLabeledDropdown`, `AiErrorView` from `lib/features/admin/ui/widgets/ai_settings_controls.dart`.
- RBAC: `ref.watch(hasCapabilityProvider(Cap.xxx))` / `ref.watch(capabilitiesProvider)`. Add the 3 new cap keys to `abstract class Cap` (`lib/features/admin/data/models/admin_models.dart`): `manageAiContext='MANAGE_AI_CONTEXT'`, `viewInternalContext='VIEW_INTERNAL_CONTEXT'`, `viewConfidentialContext='VIEW_CONFIDENTIAL_CONTEXT'`.
- **Sync rule:** this mirrors P3 exactly — same sections, same behavior, parallel i18n key names. no-raw-system-data: never render ids/JSON; show role/department names + humanized facts + localized tier labels.
- Dio picking: structured context → `DioClient.createAuthDio(...)` (3001); memories → `createChatDio(...)` (8080).

---

### Task 1: Models + repository + providers (data/domain)

**Files:**
- Create: `apps/client/lib/features/ai_context/data/ai_context_models.dart`
- Create: `apps/client/lib/features/ai_context/data/ai_context_repository.dart`
- Create: `apps/client/lib/features/ai_context/domain/ai_context_providers.dart`
- Modify: `apps/client/lib/features/chat/data/ai_memory_repository.dart` (memory array → single)
- Modify: `apps/client/lib/features/chat/domain/ai_memory_provider.dart` (state `List<AiMemoryModel>` → `AiMemoryModel?`)
- Modify: `apps/client/lib/features/admin/data/models/admin_models.dart` (add 3 `Cap.*` keys)
- Test: `apps/client/test/ai_context/ai_context_models_test.dart`

**Interfaces:**
- Produces: `AiUserContext { userId, jobTitle, projects: List<String>, style, preferences }` + `fromJson`; `AiContextEntry { id, scope, scopeId, label, text, requiredCapability, }` + `fromJson`; `MyAiContext { context, role, departmentNames, entries }` + `fromJson`; `ContextTier { public, internal, confidential }` + `tierToCapability`/`tierFromCapability`.
- `AiContextRepository` (authDio): `getMine()`, `updateMyStyle({style, preferences})`, `getUser(userId)`, `updateUserHard(userId, {jobTitle, projects})`, `listEntries(scope, {scopeId})`, `createEntry(...)`, `updateEntry(id, ...)`, `deleteEntry(id)`.
- Providers: `aiContextRepositoryProvider`, `myAiContextProvider` (`AsyncNotifier<MyAiContext>`), `memberAiContextProvider` (family), `contextEntriesProvider` (family by scope+scopeId).
- `AiMemoriesNotifier` now exposes `AiMemoryModel?` (single aggregate).

- [ ] **Step 1: Failing model test**

`test/ai_context/ai_context_models_test.dart`:
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/ai_context/data/ai_context_models.dart';

void main() {
  test('MyAiContext.fromJson parses context + identity + entries', () {
    final json = {
      'context': {'userId': 'u1', 'jobTitle': 'Dev', 'projects': ['PON'], 'style': 'brief', 'preferences': ''},
      'identity': {'role': 'Manager', 'departmentNames': ['Engineering']},
      'entries': [
        {'_id': 'e1', 'scope': 'company', 'scopeId': null, 'label': 'Mission', 'text': 'Build.', 'requiredCapability': null},
      ],
    };
    final m = MyAiContext.fromJson(json);
    expect(m.role, 'Manager');
    expect(m.departmentNames, ['Engineering']);
    expect(m.context.jobTitle, 'Dev');
    expect(m.context.projects, ['PON']);
    expect(m.entries.single.label, 'Mission');
  });

  test('tier<->capability mapping', () {
    expect(tierToCapability(ContextTier.public), isNull);
    expect(tierToCapability(ContextTier.confidential), 'VIEW_CONFIDENTIAL_CONTEXT');
    expect(tierFromCapability('VIEW_INTERNAL_CONTEXT'), ContextTier.internal);
    expect(tierFromCapability(null), ContextTier.public);
  });
}
```
(Confirm the package import name — check `apps/client/pubspec.yaml` `name:`; the plan assumes `platform_client`. Adjust the import prefix to the real package name.)

- [ ] **Step 2: Run → FAIL**

Run: `cd apps/client && flutter test test/ai_context/ai_context_models_test.dart`
Expected: FAIL — models missing.

- [ ] **Step 3: Implement models**

`ai_context_models.dart` — plain classes with `fromJson` (mirror `AiMemoryModel` style):
```dart
enum ContextTier { public, internal, confidential }

String? tierToCapability(ContextTier t) {
  switch (t) {
    case ContextTier.internal:
      return 'VIEW_INTERNAL_CONTEXT';
    case ContextTier.confidential:
      return 'VIEW_CONFIDENTIAL_CONTEXT';
    case ContextTier.public:
      return null;
  }
}

ContextTier tierFromCapability(String? cap) {
  if (cap == 'VIEW_CONFIDENTIAL_CONTEXT') return ContextTier.confidential;
  if (cap == 'VIEW_INTERNAL_CONTEXT') return ContextTier.internal;
  return ContextTier.public;
}

class AiUserContext {
  final String userId;
  final String jobTitle;
  final List<String> projects;
  final String style;
  final String preferences;
  const AiUserContext({
    required this.userId,
    required this.jobTitle,
    required this.projects,
    required this.style,
    required this.preferences,
  });
  factory AiUserContext.fromJson(Map<String, dynamic> j) => AiUserContext(
        userId: (j['userId'] ?? '') as String,
        jobTitle: (j['jobTitle'] ?? '') as String,
        projects: ((j['projects'] as List?) ?? const []).map((e) => e.toString()).toList(),
        style: (j['style'] ?? '') as String,
        preferences: (j['preferences'] ?? '') as String,
      );
}

class AiContextEntry {
  final String id;
  final String scope; // 'company' | 'department'
  final String? scopeId;
  final String label;
  final String text;
  final String? requiredCapability;
  const AiContextEntry({
    required this.id,
    required this.scope,
    required this.scopeId,
    required this.label,
    required this.text,
    required this.requiredCapability,
  });
  factory AiContextEntry.fromJson(Map<String, dynamic> j) => AiContextEntry(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        scope: (j['scope'] ?? 'company') as String,
        scopeId: j['scopeId'] as String?,
        label: (j['label'] ?? '') as String,
        text: (j['text'] ?? '') as String,
        requiredCapability: j['requiredCapability'] as String?,
      );
}

class MyAiContext {
  final AiUserContext context;
  final String? role;
  final List<String> departmentNames;
  final List<AiContextEntry> entries;
  const MyAiContext({
    required this.context,
    required this.role,
    required this.departmentNames,
    required this.entries,
  });
  factory MyAiContext.fromJson(Map<String, dynamic> j) => MyAiContext(
        context: AiUserContext.fromJson((j['context'] as Map?)?.cast<String, dynamic>() ?? {}),
        role: (j['identity']?['role']) as String?,
        departmentNames:
            (((j['identity']?['departmentNames']) as List?) ?? const []).map((e) => e.toString()).toList(),
        entries: (((j['entries']) as List?) ?? const [])
            .map((e) => AiContextEntry.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}
```

- [ ] **Step 4: Run → PASS**

Run: `flutter test test/ai_context/ai_context_models_test.dart` → PASS.

- [ ] **Step 5: Repository + providers**

`ai_context_repository.dart` — mirror `admin_repository.dart` (authDio + `onForceLogout`):
```dart
class AiContextRepository {
  AiContextRepository(this._dio);
  final Dio _dio;

  Future<MyAiContext> getMine() async {
    final r = await _dio.get('/ai-context/me');
    return MyAiContext.fromJson((r.data as Map).cast<String, dynamic>());
  }
  Future<AiUserContext> updateMyStyle({String? style, String? preferences}) async {
    final r = await _dio.patch('/ai-context/me/style', data: {
      if (style != null) 'style': style,
      if (preferences != null) 'preferences': preferences,
    });
    return AiUserContext.fromJson((r.data as Map).cast<String, dynamic>());
  }
  Future<AiUserContext> getUser(String userId) async {
    final r = await _dio.get('/ai-context/users/$userId');
    return AiUserContext.fromJson((r.data as Map).cast<String, dynamic>());
  }
  Future<AiUserContext> updateUserHard(String userId, {String? jobTitle, List<String>? projects}) async {
    final r = await _dio.patch('/ai-context/users/$userId/hard', data: {
      if (jobTitle != null) 'jobTitle': jobTitle,
      if (projects != null) 'projects': projects,
    });
    return AiUserContext.fromJson((r.data as Map).cast<String, dynamic>());
  }
  Future<List<AiContextEntry>> listEntries(String scope, {String? scopeId}) async {
    final r = await _dio.get('/ai-context/entries', queryParameters: {'scope': scope, if (scopeId != null) 'scopeId': scopeId});
    return ((r.data as List?) ?? const []).map((e) => AiContextEntry.fromJson((e as Map).cast<String, dynamic>())).toList();
  }
  Future<AiContextEntry> createEntry(Map<String, dynamic> body) async {
    final r = await _dio.post('/ai-context/entries', data: body);
    return AiContextEntry.fromJson((r.data as Map).cast<String, dynamic>());
  }
  Future<AiContextEntry> updateEntry(String id, Map<String, dynamic> body) async {
    final r = await _dio.patch('/ai-context/entries/$id', data: body);
    return AiContextEntry.fromJson((r.data as Map).cast<String, dynamic>());
  }
  Future<void> deleteEntry(String id) => _dio.delete('/ai-context/entries/$id');
}
```
`ai_context_providers.dart` — mirror `admin_providers.dart`:
```dart
final aiContextRepositoryProvider = Provider<AiContextRepository>((ref) {
  final storage = ref.read(secureStorageProvider); // use the same storage provider admin_repository uses
  return AiContextRepository(DioClient.createAuthDio(storage,
      onForceLogout: () => ref.read(authNotifierProvider.notifier).forceLogout()));
});

class MyAiContextNotifier extends AsyncNotifier<MyAiContext> {
  @override
  Future<MyAiContext> build() => ref.read(aiContextRepositoryProvider).getMine();
  Future<void> updateStyle({String? style, String? preferences}) async {
    await ref.read(aiContextRepositoryProvider).updateMyStyle(style: style, preferences: preferences);
    ref.invalidateSelf();
    await future;
  }
}
final myAiContextProvider = AsyncNotifierProvider<MyAiContextNotifier, MyAiContext>(MyAiContextNotifier.new);
```
(Confirm the exact secure-storage provider + `authNotifierProvider` import used by `admin_repository.dart` and copy those imports verbatim.)

- [ ] **Step 6: Memory contract change (array → single)**

`ai_memory_repository.dart`: `getMyMemories()` returns `AiMemoryModel?` (parse the single object; null-safe if empty body). `ai_memory_provider.dart`: change `AsyncNotifier<List<AiMemoryModel>>` → `AsyncNotifier<AiMemoryModel?>`; `build()` returns the single; drop the per-item optimistic filter in `deleteMemory` (just `ref.invalidateSelf()` after delete). Update `ai_memory_screen.dart` consumers in Task 3.

- [ ] **Step 7: Add the 3 Cap keys**

In `admin_models.dart` `abstract class Cap`, add `manageAiContext`, `viewInternalContext`, `viewConfidentialContext` constants.

- [ ] **Step 8: analyze + test + commit**

```bash
cd apps/client && flutter analyze && flutter test test/ai_context/
git add apps/client/lib/features/ai_context apps/client/lib/features/chat/data/ai_memory_repository.dart apps/client/lib/features/chat/domain/ai_memory_provider.dart apps/client/lib/features/admin/data/models/admin_models.dart apps/client/test/ai_context
git commit -m "feat(mobile): ai-context models/repo/providers + memory aggregate + caps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: analyze clean (any `ai_memory_screen.dart` break is fixed in Task 3 — if analyze fails only there, proceed to Task 3 in the same cycle).

---

### Task 2: Rename screen + route + i18n keys

**Files:**
- Rename: `apps/client/lib/features/chat/ui/ai_memory_screen.dart` → `apps/client/lib/features/ai_context/ui/ai_context_screen.dart` (class `AiMemoryScreen` → `AiContextScreen`)
- Modify: `apps/client/lib/core/router/app_router.dart` (route `/ai-memories` → `/ai-context`, import)
- Modify: `apps/client/lib/features/ai_hub/ui/ai_hub_screen.dart` (`context.push('/ai-memories')` → `/ai-context`)
- Modify: all 7 `apps/client/lib/l10n/app_*.arb` (add `aiContext*` keys)

- [ ] **Step 1: Move + rename the screen**

```bash
git mv apps/client/lib/features/chat/ui/ai_memory_screen.dart apps/client/lib/features/ai_context/ui/ai_context_screen.dart
```
Rename the class `AiMemoryScreen` → `AiContextScreen` (full rewrite happens in Task 3; here just rename so it compiles).

- [ ] **Step 2: Update the route + nav**

In `app_router.dart`: update the import path, rename the `GoRoute` `path: '/ai-context'`, `name: 'ai-context'`, builder `const AiContextScreen()`. In `ai_hub_screen.dart:175`, change `context.push('/ai-memories')` → `context.push('/ai-context')`. (No redirect needed — mobile has no external deep links to the old path; if any other `'/ai-memories'` reference exists, `grep -rn "ai-memories" lib` and update.)

- [ ] **Step 3: Add ARB keys (all 7) + gen-l10n**

Add to `app_en.arb` (then mirror to the other 6): `aiContextTitle`, `aiContextStyleLabel`, `aiContextStyleHint`, `aiContextPreferencesLabel`, `aiContextPreferencesHint`, `aiContextUpdate`, `aiContextSaving`, `aiContextStyleSaved`, `aiContextSaveError`, `aiContextRoleUnknown`, `aiContextNoDepartment`, `aiContextNotSet`, `aiContextIdentityManaged`, `aiContextIdentityTitle`, `aiContextResponseStyleTitle`, `aiContextLearnedFactsTitle`, `aiContextCompanyTitle`, `aiContextDepartmentTitle`, `aiContextMemoryEmpty`, `aiContextMemoryEmptyHint`, `aiContextTierPublic`, `aiContextTierInternal`, `aiContextTierConfidential`. Keep the old `aiMemory*` keys for now (still referenced until Task 3 rewrite; remove any left unused at the end). Run:
```bash
cd apps/client && flutter gen-l10n
```

- [ ] **Step 4: analyze + commit**

```bash
flutter analyze
git add apps/client/lib/features/ai_context apps/client/lib/features/chat/ui apps/client/lib/core/router/app_router.dart apps/client/lib/features/ai_hub/ui/ai_hub_screen.dart apps/client/lib/l10n
git commit -m "feat(mobile): rename AI Memory screen/route to AI Context + i18n keys

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Build the AI Context screen (4 sections)

**Files:**
- Rewrite: `apps/client/lib/features/ai_context/ui/ai_context_screen.dart` (orchestrator; < 400 lines)
- Create: `apps/client/lib/features/ai_context/ui/widgets/identity_section.dart`, `response_style_section.dart`, `learned_facts_section.dart`, `company_context_section.dart`

**Interfaces:** consumes `myAiContextProvider` + the memory provider. `response_style_section` calls `myAiContextProvider.notifier.updateStyle(...)`.

- [ ] **Step 1: Screen scaffold**

Rewrite `ai_context_screen.dart` as `ConsumerWidget`: `Scaffold` with `AppBar(title: Text(context.l10n.aiContextTitle))`, body `ref.watch(myAiContextProvider).when(data:, loading: CircularProgressIndicator, error: (e,_) => AiErrorView(...))`. On data, a scrollable `Column` of the four section widgets (pass the `MyAiContext`). Use `PonCard` for section containers, `AppTheme` colors.

- [ ] **Step 2: IdentitySection (read-only)**

`identity_section.dart` — `PonCard` with `AiSectionTitle(context.l10n.aiContextIdentityTitle)` then rows: Role (`ctx.role ?? l10n.aiContextRoleUnknown`), Departments (`ctx.departmentNames.join(', ')` or `l10n.aiContextNoDepartment`), Job title (`ctx.context.jobTitle` or `l10n.aiContextNotSet`), Projects (chips or comma list or `notSet`). Footnote `AiMutedText(l10n.aiContextIdentityManaged)`.

- [ ] **Step 3: ResponseStyleSection (self-edit + Update)**

`response_style_section.dart` — `ConsumerStatefulWidget`. Two `PonTextField`/`TextField(maxLines: 4, maxLength: 2000)` controllers seeded once from `context.style`/`preferences` (mirror `ai_persona_screen.dart` `_initFromPersona`). A `PonButton` labeled `l10n.aiContextUpdate` (or `aiContextSaving` while pending) that calls `ref.read(myAiContextProvider.notifier).updateStyle(style: ..., preferences: ...)`, then `showInfoSnackBar(context, l10n.aiContextStyleSaved)`; on error `friendlyError(e)`. Disable when not dirty.

- [ ] **Step 4: LearnedFactsSection**

`learned_facts_section.dart` — `ConsumerWidget` watching the memory provider (single `AiMemoryModel?`). Render `keyFacts` list + `summary` + `messageCount` badge; empty state (`aiContextMemoryEmpty`/`Hint`) when null/empty. Deletion is whole-memory (per-conversation) only if a real `conversationId` exists on the aggregate — since the aggregate's `conversationId` is null, hide per-fact delete here (individual-fact deletion is out of P4 scope, mirroring P3). Never render ids.

- [ ] **Step 5: CompanyContextSection (read-only, role-filtered)**

`company_context_section.dart` — group `entries` by `scope`; render each `label` + `text` in a `PonCard` with a tier chip from `tierFromCapability(entry.requiredCapability)` → localized (`aiContextTierPublic/Internal/Confidential`). Empty state when none.

- [ ] **Step 6: analyze + widget test + commit**

Add a widget test `test/ai_context/response_style_section_test.dart` (pump the section in a `ProviderScope` with an overridden `myAiContextProvider`, enter text, tap Update, verify the notifier method fired — use a fake notifier). Then:
```bash
cd apps/client && flutter analyze && flutter test test/ai_context/
git add apps/client/lib/features/ai_context apps/client/test/ai_context
git commit -m "feat(mobile): AI Context screen — identity, response style, learned facts, company context

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Admin — per-member "Edit AI context"

**Files:**
- Modify: `apps/client/lib/features/admin/ui/widgets/members_panel.dart` (add a second per-row action)
- Create: `apps/client/lib/features/admin/ui/widgets/edit_member_ai_context_dialog.dart`
- Modify: `apps/client/lib/features/ai_context/domain/ai_context_providers.dart` (member family + update)
- Modify: all 7 `app_*.arb` (`adminAiContext*` keys)

**Interfaces:** `memberAiContextProvider = FutureProvider.family<AiUserContext, String>((ref, userId) => repo.getUser(userId))`; a method `updateMemberHard(userId, {jobTitle, projects})` on the repo path invoked from the dialog, then `ref.invalidate(memberAiContextProvider(userId))`.

- [ ] **Step 1: Provider(s)** — add the family + an update helper to `ai_context_providers.dart`.

- [ ] **Step 2: Dialog** — `edit_member_ai_context_dialog.dart`: an `AlertDialog` (mirror `members_panel.dart` `_edit`), a jobTitle `PonTextField` + a projects multiline field (one project per line → `List<String>`), seeded from `ref.watch(memberAiContextProvider(member.id))`. Save → `repo.updateUserHard(member.id, jobTitle:, projects:)` → `showInfoSnackBar(context, l10n.adminToastSaved)`.

- [ ] **Step 3: Wire into members_panel** — add a second `IconButton` (e.g. `Icons.psychology_outlined`) per member row opening the dialog, gated by `ref.watch(hasCapabilityProvider(Cap.manageMembers))` (server also enforces dept-lead). Keep the existing edit action.

- [ ] **Step 4: ARB (7) + gen-l10n + analyze + commit**

Add `adminEditAiContext`, `adminAiContextJobTitle`, `adminAiContextProjects`, `adminAiContextProjectsHint`. Then:
```bash
cd apps/client && flutter gen-l10n && flutter analyze && flutter test
git add apps/client/lib/features/admin apps/client/lib/features/ai_context apps/client/lib/l10n
git commit -m "feat(mobile): admin per-member Edit AI context (job title + projects)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Admin — Company/Department AI context editor panel

**Files:**
- Create: `apps/client/lib/features/admin/ui/widgets/ai_context_entries_panel.dart`
- Modify: `apps/client/lib/features/admin/ui/admin_screen.dart` (register a `_Section` gated by `Cap.manageAiContext`)
- Modify: `apps/client/lib/features/ai_context/domain/ai_context_providers.dart` (entries family + CRUD)
- Modify: all 7 `app_*.arb` (`adminAiContextEntries*` keys)

**Interfaces:** `contextEntriesProvider = FutureProvider.family<List<AiContextEntry>, ({String scope, String? scopeId})>(...)`; CRUD helpers calling `repo.createEntry/updateEntry/deleteEntry`, invalidating the family.

- [ ] **Step 1: Providers** — entries family + create/update/delete helpers in `ai_context_providers.dart`.

- [ ] **Step 2: Panel** — `ai_context_entries_panel.dart` (`ConsumerWidget`): scope toggle (Company / Department + department dropdown via the admin departments provider), a list of entries (label + text preview + tier chip) each with edit/delete, and a create/edit dialog with label `PonTextField`, text multiline field, tier `AiLabeledDropdown` (Public/Internal/Confidential → `tierToCapability`), department picker for department scope. Use the CRUD helpers; snackbars via `l10n.adminToastSaved`.

- [ ] **Step 3: Register the section** — in `admin_screen.dart`, add a `_Section(cap: Cap.manageAiContext, icon: Icons.psychology, label: l10n.adminAiContextEntriesTitle, panel: const AiContextEntriesPanel())` (filtered by `caps.has(s.cap)` like the others).

- [ ] **Step 4: ARB (7) + gen-l10n + full analyze/test + commit**

Add `adminAiContextEntriesTitle`, `adminEntryLabel`, `adminEntryText`, `adminEntryTier`, `adminEntryScope`, `adminScopeCompany`, `adminScopeDepartment`, `adminCreateEntry`, `adminEditEntry`, `adminDeleteEntry`, `adminDeleteEntryConfirm`. Then:
```bash
cd apps/client && flutter gen-l10n && flutter analyze && flutter test
git add apps/client/lib/features/admin apps/client/lib/features/ai_context apps/client/lib/l10n
git commit -m "feat(mobile): admin Company/Department AI context editor (CRUD + tiers)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: `flutter analyze` clean, `flutter test` green. Also remove any now-unused `aiMemory*` ARB keys and confirm no `'/ai-memories'` / `AiMemoryScreen` references remain (`grep -rn "ai-memories\|AiMemoryScreen" lib`).

---

## Self-Review

**Spec coverage (§9, mobile mirror of P3):**
- Rename screen/route → Task 2. ✅
- 4 sections (identity/org, response style + Update, learned facts, company/dept role-filtered) → Task 3, consuming P3 Task 1's `identity` + P2b aggregate. ✅
- Admin per-member editor → Task 4; company/department entries editor + tiers → Task 5. ✅
- i18n 7 ARB + gen-l10n, no-raw-system-data, sync parity with P3 (same sections/keys) → enforced per task. ✅
- Depends on P3 Task 1 backend (`identity` on `GET /ai-context/me`) — stated in Architecture; if P4 runs before P3, do P3 Task 1 first.

**Placeholder scan:** No TBD/TODO. Full code for models + repository + providers (the load-bearing parts). UI sections have concrete widget/behavior specs + the exact existing file to mirror (`ai_persona_screen.dart`, `members_panel.dart`, `ai_settings_controls.dart`). Two verify-and-adapt notes (package import name; the secure-storage/authNotifier provider imports used by `admin_repository.dart`) are concrete instructions, not placeholders. Per-fact-vs-per-memory delete resolved explicitly (Task 3 Step 4), mirroring P3.

**Type consistency:** `AiUserContext`/`AiContextEntry`/`MyAiContext`/`ContextTier` defined in Task 1 and consumed in Tasks 3–5. `tierToCapability`/`tierFromCapability` consistent. `getMyMemories(): AiMemoryModel?` (single) consistent between Task 1 and Task 3. `Cap.manageAiContext`/`viewInternalContext`/`viewConfidentialContext` used in gating consistently. Endpoint paths match the auth-service controller (`/ai-context/me`, `/me/style`, `/users/:id/hard`, `/entries`) and P3's web client exactly.

## Execution Handoff

See end of conversation for execution-mode choice.
