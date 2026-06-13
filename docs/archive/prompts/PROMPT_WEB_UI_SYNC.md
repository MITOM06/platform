# PROMPT: Sync Web UI to PON Brand Design System

Read `CLAUDE.md` and `apps/web/CLAUDE.md` first.

The Next.js web app was built with shadcn default theme (grey oklch colors).
The Flutter app has a defined brand design system. This prompt syncs the web to match.

## Brand Tokens (from apps/client/lib/core/theme/app_theme.dart)

```
Cyan:    #6AC9FF  ← primary brand color
Peach:   #FBB68B  ← secondary
Pink:    #FF85B3  ← accent
Gradient: cyan → peach → pink (135deg)

Online green: #00E676
Offline grey: #9E9E9E

Dark theme:
  background: #121212
  surface:    #1E1E1E
  border:     #2C2C2C

Light theme:
  background: #F5F7FA
  surface:    #FFFFFF
  border:     #E5E7EB

Border radius: 24px (all cards, inputs, buttons)
Input padding: 24px horizontal, 18px vertical
Button font:   700 weight, 0.5px letter-spacing
```

## Task 1 — Update globals.css

File: `apps/web/app/globals.css`

Replace the CSS custom properties to match PON brand. Keep the same variable names
(shadcn components use them) but update values:

```css
:root {
  --radius: 1.5rem; /* 24px */
  --background: #F5F7FA;
  --foreground: #111827;
  --card: #FFFFFF;
  --card-foreground: #111827;
  --popover: #FFFFFF;
  --popover-foreground: #111827;
  --primary: #6AC9FF;
  --primary-foreground: #FFFFFF;
  --secondary: #FF85B3;
  --secondary-foreground: #FFFFFF;
  --muted: #F3F4F6;
  --muted-foreground: #6B7280;
  --accent: #FBB68B;
  --accent-foreground: #111827;
  --destructive: #EF4444;
  --border: #E5E7EB;
  --input: #FFFFFF;
  --ring: #6AC9FF;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #111827;
  --sidebar-border: #E5E7EB;
}

.dark {
  --background: #121212;
  --foreground: #F9FAFB;
  --card: #1E1E1E;
  --card-foreground: #F9FAFB;
  --popover: #1E1E1E;
  --popover-foreground: #F9FAFB;
  --primary: #6AC9FF;
  --primary-foreground: #FFFFFF;
  --secondary: #FF85B3;
  --secondary-foreground: #FFFFFF;
  --muted: #2C2C2C;
  --muted-foreground: #9CA3AF;
  --accent: #FBB68B;
  --accent-foreground: #F9FAFB;
  --destructive: #F87171;
  --border: #2C2C2C;
  --input: #1E1E1E;
  --ring: #6AC9FF;
  --sidebar: #1E1E1E;
  --sidebar-foreground: #F9FAFB;
  --sidebar-border: #2C2C2C;
}
```

Also add these utility classes at the bottom of globals.css:
```css
.pon-gradient {
  background: linear-gradient(135deg, #6AC9FF 0%, #FBB68B 50%, #FF85B3 100%);
}

.pon-gradient-text {
  background: linear-gradient(135deg, #6AC9FF 0%, #FBB68B 50%, #FF85B3 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

## Task 2 — Update Auth pages to match Flutter UI

### Login page — `apps/web/app/(auth)/login/page.tsx`

Flutter login screen has:
- Dark/light background (full screen)
- App logo/name at top with gradient text "PON" or app name
- Card with rounded-[24px], no shadow, border
- Email input: rounded-[24px], filled background
- Password input: same style with show/hide toggle
- Login button: full width, rounded-[24px], primary cyan color, bold
- "Don't have account? Register" link below
- Google/Facebook OAuth buttons (outline style) if env vars set

Rewrite login page to match this layout. Use Tailwind classes with the updated CSS vars.
Key classes: `bg-background`, `rounded-3xl` (= 24px), `bg-card`, `border-border`.

### Register page — `apps/web/app/(auth)/register/page.tsx`
Same card layout as login. Fields: Display Name, Email, Password, Confirm Password.

### OTP verify page — `apps/web/app/(auth)/verify-otp/page.tsx`
- 6 individual digit input boxes (one per digit), auto-focus next on input
- Resend OTP button with countdown timer
- Same card + rounded style

## Task 3 — Update tailwind.config to extend with brand colors

File: `apps/web/tailwind.config.ts` (or wherever Tailwind is configured)

Add to `theme.extend.colors`:
```typescript
colors: {
  'pon-cyan': '#6AC9FF',
  'pon-peach': '#FBB68B',
  'pon-pink': '#FF85B3',
  'online-green': '#00E676',
}
```

## Task 4 — Update default theme to dark

The Flutter app defaults to dark theme. Update `apps/web/app/layout.tsx`:

```tsx
// next-themes defaultTheme="dark"
<ThemeProvider defaultTheme="dark" attribute="class" ...>
```

## Task 5 — Verify build

```bash
cd apps/web
pnpm build
```

Fix any errors. Must build clean.

## Task 6 — Commit

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx apps/web/tailwind.config.ts \
  apps/web/app/(auth)/
git commit -m "style(web): sync PON brand design system — cyan/peach/pink, dark default, rounded-3xl"
git push origin main
```

## DO NOT

- Do not change business logic, API calls, state management
- Do not modify shadcn components in `components/ui/` directly — only globals.css vars
- Do not add new dependencies
