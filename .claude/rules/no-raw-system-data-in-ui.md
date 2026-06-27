# Rule — Never Show Raw System/Internal Data to Users

> Applies to **every** user-facing surface on **both** platforms (Flutter `apps/client/`
> and Next.js `apps/web/`). This is a hard rule. Violations are P1 bugs.

## The Rule

The UI must **never** display raw system, internal, or machine-oriented data to an end user.
Everything shown to a user must be humanized and localized first.

Specifically, the following must **never** appear in any user-visible text (message bubbles,
pinned previews, conversation list, banners, toasts, snackbars, dialogs, tooltips, labels):

1. **Raw system messages / system message codes.**
   System messages are stored as structured codes such as
   `system.nickname.changed:<userId>:<value>` or `system.message.pinned:<actorId>`.
   These are NOT display text. Always pass them through the humanizer
   (`humanizeSystemMessage` on web / `SystemMessage` + the system-message parser on mobile)
   to get a localized, friendly sentence. A pinned/quoted/previewed system message must be
   humanized the same way it is in the main bubble.

2. **Raw user IDs.** Never render a Mongo ObjectId or any user id (`6e3f...`, `"system"`,
   `extbot:...`). Resolve it to a display name first. If the name cannot be resolved, fall
   back to a generic localized label (e.g. "Someone" / "Hệ thống"), never the id.

3. **Internal URLs / storage paths.** Never show `/api/uploads/6e8f...`, GridFS ids, blob
   URLs, or any raw href as text. File/media messages must render a humanized card
   (icon + file name + size) or a localized attachment label (e.g. `[Photo]`, `[File]`),
   never the URL string.

4. **Raw backend error text / exceptions.** Never surface `DioException`, stack traces,
   `MessageDeliveryException`, HTTP bodies, or any server exception message. Map the error to
   the **correct, specific** localized message for that error type (wrong password, network
   down, rate limited, not found, …). Only use a generic "something went wrong" string when
   the error type is genuinely unknown — and even then, localized, never the raw text.

5. **JSON / serialized payloads.** Never render a raw JSON string (e.g. a file message's
   `{"url":...,"name":...,"size":...}` content, or an AI trace payload) as message text.
   Parse it and render the structured UI.

## How To Comply

- **System messages:** route every code through the shared humanizer
  - web: `apps/web/lib/system-messages.ts` → `humanizeSystemMessage(content, t, { resolveName })`
  - mobile: the `SystemMessage` widget / system-message parser in
    `apps/client/lib/features/chat/...`
  Apply it everywhere a message can be previewed — bubbles **and** pinned bars/sections,
  reply quotes, conversation-list last-message, notification bodies.
- **Errors:** map to a typed, localized string. On mobile use `friendlyError()` /
  `context.l10n.*`; never `e.toString()` in a snackbar. On web use the typed error → i18n key,
  never `err.message` raw. Read the auth error contract before mapping
  (error body is `{code, params}` at top level).
- **Never gate humanization on "is this the main bubble".** If a value can reach the user,
  it must already be humanized at the source or sanitized at the render site.

## Defense In Depth

- Prefer **not generating** leakable data in the first place: e.g. system messages should not
  be pinnable; the backend should reject pinning a `system` message and filter `system`
  messages out of any preview/pinned list it returns.
- Then **sanitize at every render site** as well, so already-stored or cross-platform data
  can never leak.

## Cross-Platform

Per `.claude/rules/sync.md`, any fix here must be applied to **both** web and mobile. A surface
that humanizes on web but leaks on mobile (or vice versa) is still a violation.
