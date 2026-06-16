# QA Report — SPRINT W-15 (Chat UI/UX Refinement & Parity, Web-only) — 2026-06-16

## Build status
| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npx next build` | PASS — exit 0, all 24 routes generated |

## Per-task verdict

| Task | Verdict | Evidence |
|------|---------|----------|
| W-15.1 sidebar "You:" + system humanizer | PASS | `lib/system-messages.ts` covers theme/quick_reaction/nickname + group/member codes + attachment detection. `ConversationItem.tsx` `previewText` prefixes "You:" only for own direct non-system messages. `MessageBubble.tsx` uses the shared humanizer. |
| W-15.2 wallpaper preview + scale + group unify | PASS | `WallpaperPickerModal.tsx` has mock-chat preview, scale slider 50-200%, upload error toast, `#fit=&scale=` encoding, applies only on Confirm + broadcasts `system.theme.changed:`. `page.tsx` `resolveWallpaper` parses `&scale=` with backward compat. `GroupSettingsDrawer` now opens the same modal; flat-key grid removed. |
| W-15.3 quick reaction | PASS | `lib/quick-reaction.ts` mirrors nicknames (default 👍, key `chat_quick_reaction_<id>`, reactive hook). Picker wired in both `CustomizeChatSection.tsx` and `GroupSettingsDrawer.tsx`. `MessageInput.tsx` uses `useQuickReaction` instead of hard-coded 👍. `page.tsx` applies system message in historical + STOMP handlers. |
| W-15.4 2-row nickname editor | PASS | `CustomizeChatSection.tsx` renders other+you rows (gated `isDirect`), each broadcasts `nicknameSystemMessage`. Applied in sidebar, bubbles, header. |
| W-15.5 GroupSettingsDrawer accordion | PASS | Full `Accordion type="multiple"` with 4 sections, 369 lines (<400), `GroupMemberRow` extracted, all handlers preserved. |

## Cross-platform format parity (byte-for-byte vs Flutter)
- `system.theme.changed:<value>` — matches `chat_wallpaper_dialog.dart`. Flutter ignores `&scale=` suffix → safe.
- `system.nickname.changed:<userId>:<nickname>` — matches `conversation_customisation_dialogs.dart` / `chat_provider.dart`. Equivalent split logic, handles nicknames containing `:`.
- `system.quick_reaction.changed:<emoji>` — matches Flutter, default 👍.
- Storage keys `chat_quick_reaction_<id>`, `chat_nicknames_<id>`, `wallpaper-<id>` match Flutter shared_preferences keys.

## i18n completeness
All 17 new keys present in all 7 locales (en/vi/zh/ja/ko/es/fr).

## Issues found

| Severity | Location | Finding | Recommendation |
|----------|----------|---------|----------------|
| Low (pre-existing) | `MessageInput.tsx` (528 lines), `app/(main)/conversations/[id]/page.tsx` (566 lines) | Both exceed 400-line clean-code limit. Pre-existing before sprint (526/544); sprint added +2/+22. Not introduced by W-15. | Follow-up refactor ticket. Not a sprint blocker. |
| Info | `ConversationSettingsDrawer.tsx` | `onLeaveGroup={() => toast('Coming soon')}` confirmed dead for groups — `ConversationHeader.tsx` routes group settings to `GroupSettingsDrawer` (real handler). Unreachable stub. | Leave as-is or delete in follow-up. |
| Info | `MessageBubble.tsx` reply-preview sender | Pre-existing limitation, nickname-first resolution correct. | No action. |

## Conclusion
**PASS** — All 5 tasks meet Done criteria, verified by direct file inspection. Build clean, system-message formats byte-for-byte compatible with Flutter, i18n complete, no sync-breaking divergences. No blocking issues.
