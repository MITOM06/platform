# QC Audit Plan — Full UI Review (Web + Mobile)
> Date: 2026-06-16 · Branch: `chore/full-qc-ui-audit`
> Source: 2 parallel audit agents (web + Flutter) + re-verification of TODO.md open backlog
> (W-16.5, W-17.3, W-17.5, W-17.6).

## Already verified as FIXED (no action needed)
- W-17.3 Privacy Policy link — works on both web (`/privacy` route exists) and Flutter (launches external browser).
- W-17.5 Mobile-web nav for Profile/Settings — `router.push()` wired correctly in `layout.tsx`.
- W-16.6 Bio persistence bug — form correctly `reset()`s from loaded user data.
- W-17.6 Global chat search scope — **web** already filters by group name + nickname + display name. **Flutter is missing this entirely (see Task 5 below).**
- Call buttons (voice/video) — properly wired on web.

## Task List (execute in order, verify after each)

- [x] **Task 1 [Web/CRITICAL]: "Leave Group" button is a no-op** — DONE, commit `17ee14fb`.
  - File: `apps/web/components/chat/ConversationSettingsDrawer.tsx:337`
  - Problem: `onLeaveGroup={() => toast('Coming soon')}` — does not call any API.
  - Fix: add `leaveGroup(id)` to `apps/web/lib/api/chat.ts` (`POST /api/conversations/{id}/leave`, mirrors backend `removeMember`/leave endpoint), wire the drawer button to call it, invalidate conversations query + navigate away on success.
  - Verify: `npx tsc --noEmit` (apps/web) clean.

- [x] **Task 2 [Web/HIGH]: Duplicate sidebar nav buttons (W-16.5 incomplete)** — DONE, commit `17ee14fb`.
  - Files: `apps/web/app/(main)/layout.tsx` (header: Explore + New-chat dropdown + Contacts + Avatar) vs `apps/web/components/chat/ConversationList.tsx:114-153` (also renders Explore/Hash + New/Plus buttons)
  - Problem: Explore and New-Conversation actions are duplicated in two different headers — visual clutter, violates W-16.5 consolidation intent.
  - Fix: keep the single source of truth in `layout.tsx` header; remove the duplicate Hash/Plus buttons from `ConversationList.tsx`, keep only the search bar + AI bot entry there.
  - Verify: `npx tsc --noEmit` clean; manually confirm only one Explore/New-chat affordance remains.

- [x] **Task 3 [Mobile/HIGH]: "Delete Conversation" button is a no-op** — DONE.
  - File: `apps/client/lib/features/chat/ui/widgets/conversation_info_sidebar.dart:262`
  - Problem: `onTap: () {}` — empty handler, button does nothing.
  - Fix: wire to a confirm dialog → `conversationsNotifierProvider` (or equivalent existing delete method already used elsewhere) → pop back to conversation list on success. Mirror web's `ConversationSettingsDrawer` delete-conversation flow (confirm dialog with destructive styling).
  - Verify: `flutter analyze` clean.

- [x] **Task 4 [Mobile/HIGH]: AI persona avatar — URL text field instead of upload (parity gap from W-14.7)** — DONE.
  - File: `apps/client/lib/features/chat/ui/ai_persona_screen.dart:157-164`
  - Problem: avatar is a plain "Avatar URL" text input; web already upgraded to click-to-upload (W-14.7).
  - Fix: replace text field with tap-to-upload avatar preview (image_picker → existing upload repository method used elsewhere in the app, e.g. for profile/cover photo) → store returned URL in the persona form state.
  - Verify: `flutter analyze` clean.

- [x] **Task 5 [Mobile/HIGH]: Conversation list has no search (parity gap, mirrors web W-17.6)** — DONE.
  - File: `apps/client/lib/features/chat/ui/conversation_list_screen.dart` (364 lines — close to the 400-line widget limit, extract to a new small widget file if needed)
  - Problem: no way to filter the conversation list by group name or contact nickname; web has this.
  - Fix: add a search field above the list (extract as `widgets/conversation_search_bar.dart` to stay within file-length rules) that filters the existing conversation list client-side by group name, cached nickname, and participant display name — mirroring `apps/web/components/chat/ConversationList.tsx`'s `resolveSearchTerms()`.
  - Verify: `flutter analyze` clean.

## Final steps (after all tasks done)
- [ ] Re-run `flutter analyze` + `flutter test` (apps/client)
- [ ] Re-run `npx tsc --noEmit` + `pnpm build` (apps/web)
- [ ] Update `TODO.md` — close W-16.5 fully, add new QC sprint entry referencing this file
- [ ] Commit per task (or squash), push branch `chore/full-qc-ui-audit`, open for review
