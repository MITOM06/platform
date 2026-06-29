# Brand Identity & Cover Fix Plan
Date: 2026-06-29

## Context
Three improvements:
A. Favicon + web metadata (currently shows Vercel/Next.js default)
B. Email OTP template redesign (plain HTML → branded PON design)
C. Cover image ratio fix (full-bleed → constrained rectangle)

---

## Part A — Favicon & Web Metadata

### Task 1 — Create PON favicon SVG
**File:** `apps/web/app/icon.svg` (CREATE NEW)

Next.js App Router automatically serves `app/icon.svg` as the browser tab favicon. Create it with PON brand gradient colors (`#6AC9FF` cyan, `#FBB68B` peach, `#FF85B3` pink).

Design: circular background with gradient, white letter "P" centered.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6AC9FF"/>
      <stop offset="50%" stop-color="#FBB68B"/>
      <stop offset="100%" stop-color="#FF85B3"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#g)"/>
  <text x="16" y="23" font-family="Arial Black, sans-serif" font-size="18" font-weight="900"
        fill="white" text-anchor="middle" letter-spacing="-0.5">P</text>
</svg>
```

### Task 2 — Update layout.tsx metadata
**File:** `apps/web/app/layout.tsx`

Replace the current generic metadata with PON-branded values:

```ts
export const metadata: Metadata = {
  title: {
    default: 'PON',
    template: '%s | PON',
  },
  description: 'PON – Nhắn tin, kết nối và cộng tác cùng AI',
  icons: {
    icon: '/icon.svg',
  },
}
```

The `template` ensures page-level titles show as e.g. "Chỉnh sửa hồ sơ | PON".

---

## Part B — Email OTP Template Redesign

### Task 3 — Redesign otp.ejs
**File:** `apps/server/auth-service/src/modules/Email/templates/otp.ejs`

The current template is plain HTML without branding. Redesign with:
- Outer gray wrapper (email-safe table layout)
- White card with `border-radius: 16px` and shadow
- Gradient header band (PON brand colors) with "PON" text logo
- Clean body: greeting, instruction, OTP code box
- Footer: expiry note, do-not-share warning, copyright

**PON brand colors (inline — CSS variables don't work in email clients):**
- Cyan: `#6AC9FF`
- Peach: `#FBB68B`
- Pink: `#FF85B3`

**Replace entire file content:**

```ejs
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= t.subject %></title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6; padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,0.08);
                      max-width:480px; width:100%; overflow:hidden;">

          <!-- Gradient header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6AC9FF 0%,#FBB68B 50%,#FF85B3 100%);
                       padding:36px 40px; text-align:center;">
              <!-- Logo badge -->
              <div style="display:inline-block; background:rgba(255,255,255,0.2);
                          border-radius:12px; padding:8px 22px; margin-bottom:14px;">
                <span style="font-size:26px; font-weight:900; color:#ffffff;
                             letter-spacing:5px; font-family:'Arial Black',sans-serif;">PON</span>
              </div>
              <!-- Email title -->
              <div style="font-size:18px; font-weight:700; color:#ffffff; line-height:1.4;">
                <%= t.heading %>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="font-size:16px; color:#111827; margin:0 0 10px; font-weight:500;">
                <%= t.greeting %>
              </p>
              <p style="font-size:14px; color:#6B7280; margin:0 0 28px; line-height:1.6;">
                <%= t.instruction %>
              </p>

              <!-- OTP code box -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#f0f9ff; border:2px solid #6AC9FF; border-radius:12px;
                             padding:22px 16px; text-align:center;">
                    <span style="font-size:38px; font-weight:800; letter-spacing:14px;
                                 color:#1d4ed8; font-family:'Courier New',Courier,monospace;
                                 display:inline-block; padding-left:14px;">
                      <%= otp %>
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Expiry note -->
              <p style="font-size:13px; color:#9CA3AF; margin:18px 0 0; text-align:center; line-height:1.5;">
                <%= t.expiryNote %>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #E5E7EB;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px; text-align:center;">
              <p style="font-size:12px; color:#9CA3AF; margin:0; line-height:1.8;">
                Nếu bạn không yêu cầu mã này, hãy bỏ qua email này.<br/>
                Không chia sẻ mã OTP với bất kỳ ai.<br/>
                <span style="color:#D1D5DB;">© 2025 PON. All rights reserved.</span>
              </p>
            </td>
          </tr>

        </table>

        <!-- Bottom spacing -->
        <p style="font-size:12px; color:#9CA3AF; margin:20px 0 0; text-align:center;">
          Sent by PON Support
        </p>

      </td>
    </tr>
  </table>

</body>
</html>
```

**Note:** EJS renders this as the full email HTML (no wrapping by `@nestjs-modules/mailer` since the adapter sees a full `<!DOCTYPE html>`). The `t.*` variables come from `otp-i18n.ts` context injected in `mail.service.ts`.

---

## Part C — Cover Image Ratio Fix

### Task 4 — Constrain cover inside max-w-2xl container
**File:** `apps/web/components/profile/ProfileImageHeader.tsx`

**Problem:** The cover `<div>` is `w-full` at the root level → spans full screen width. The avatar container below has `max-w-2xl mx-auto px-6` but the cover ignores it, creating a very wide aspect ratio.

**Fix:** Wrap the entire header (cover + avatar + user info) in a single `max-w-2xl mx-auto` container. The cover gets `rounded-xl` and `mx-6` horizontal margins to sit inside the container.

**Current structure:**
```jsx
<>
  {/* Cover - FULL BLEED */}
  <div className="relative h-32 w-full overflow-hidden group">
    ...
  </div>

  {/* Avatar + info in container */}
  <div className="relative max-w-2xl mx-auto px-6">
    <div className="flex justify-center -mt-14">
      ...avatar...
    </div>
    <div className="text-center mt-4 mb-8">
      ...user info...
    </div>
  </div>
</>
```

**New structure:**
```jsx
<div className="max-w-2xl mx-auto px-6 pt-6">
  {/* Cover - CONTAINED RECTANGLE with rounded corners */}
  <div className="relative h-36 rounded-xl overflow-hidden group">
    {resolvedCover ? (
      <Image src={resolvedCover} alt="" fill unoptimized className="object-cover" />
    ) : (
      <div className="absolute inset-0 bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink" />
    )}
    <div className="absolute inset-0 bg-black/20" />

    <button
      onClick={() => coverInputRef.current?.click()}
      className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors text-white text-xs font-medium px-3 py-1.5 backdrop-blur-sm"
    >
      <ImagePlus className="size-3.5" />
      {changeCoverLabel}
    </button>
    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverPick} />
  </div>

  {/* Avatar overlapping cover */}
  <div className="flex justify-center -mt-14">
    <div className="relative group">
      <Avatar className="size-28 ring-4 ring-background shadow-xl">
        ...
      </Avatar>
      ...camera button and overlay...
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarPick} />
    </div>
  </div>

  {/* User info */}
  <div className="text-center mt-4 mb-8">
    <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
    <p className="text-sm text-muted-foreground mt-1">{email}</p>
  </div>
</div>
```

**Key changes:**
- Outer fragment `<>` → single `<div className="max-w-2xl mx-auto px-6 pt-6">`
- Cover `className` changes: `h-32 w-full overflow-hidden` → `h-36 rounded-xl overflow-hidden` (h-36 gives better proportion at narrower width; `w-full` removed since it's now inside container's padding)
- Avatar container: remove the old `max-w-2xl mx-auto px-6` wrapper since parent already provides it; keep `-mt-14` overlap
- User info: move inside same parent container (was already inside the old inner wrapper)

**Result:** Cover becomes a rounded rectangle card ~672px wide × 144px tall (≈ 4.7:1 aspect ratio, much more balanced than full-screen ~14:1).

### Task 5 — Remove redundant container in edit/page.tsx
**File:** `apps/web/app/(main)/profile/edit/page.tsx`

After Task 4, `ProfileImageHeader` now owns `max-w-2xl mx-auto px-6`. The `<Separator>` and `ProfileForm` below are wrapped in `<div className="relative max-w-2xl mx-auto px-6">` — this is still correct and should remain unchanged. No change needed in `edit/page.tsx`.

> ✅ Actually verify: check that the `Separator` + form container still uses `max-w-2xl mx-auto px-6` independently. If both use the same width, the page aligns correctly. No change needed.

---

## Summary of files changed

| File | Change |
|---|---|
| `apps/web/app/icon.svg` | CREATE: PON gradient favicon SVG |
| `apps/web/app/layout.tsx` | UPDATE: title → `'PON'` with template, description, icons |
| `apps/server/auth-service/src/modules/Email/templates/otp.ejs` | UPDATE: full redesign with gradient header, OTP box, footer |
| `apps/web/components/profile/ProfileImageHeader.tsx` | UPDATE: cover inside max-w-2xl container with rounded-xl |

---

## Checklist for Claude Code

- [ ] Task 1: Create `apps/web/app/icon.svg` with PON gradient + "P" letter
- [ ] Task 2: Update `apps/web/app/layout.tsx` metadata (title, template, description, icons)
- [ ] Task 3: Replace `otp.ejs` with full branded HTML template
- [ ] Task 4: Refactor `ProfileImageHeader.tsx` — wrap in `max-w-2xl mx-auto px-6 pt-6`, change cover to `h-36 rounded-xl overflow-hidden`, remove the now-redundant inner container
- [ ] Verify: dev server renders correct favicon (check browser tab after `next dev`)
- [ ] Verify: send a test OTP email and confirm layout renders correctly in Gmail
- [ ] Verify: edit profile page cover is a rectangle, not full-bleed
