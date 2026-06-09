# Web (Next.js) — Rules

> Applies to `apps/web/`. Read alongside `apps/web/CLAUDE.md`.

## Next.js Patterns

- **App Router only** — no `pages/` directory.
- Server Components by default. Add `'use client'` only when needed (hooks, browser APIs, STOMP).
- Route groups: `(auth)` = public, `(main)` = protected. Layout per group.
- Data fetching in Server Components via direct API call (no axios — use `fetch` with `cache`). Client-side mutations → TanStack Query mutations + axios.
- Never call auth-service or chat-service from Server Components in production — CORS + token forwarding complexity. Use client-side axios instances instead.

## Component Rules

- shadcn/ui components → `components/ui/`. Never edit these files directly.
- Domain components → `components/chat/`, `components/layout/`.
- Max 400 lines per file.
- Extract sub-components when JSX tree > 5 levels deep.

## State Rules

- **Auth state** (user, token) → Zustand `auth.store.ts`. Persist token in memory only.
- **Server data** (messages, conversations) → TanStack Query. No Zustand for server data.
- **UI state** (modal open, selected conversation) → local `useState` or Zustand if shared.

## API Rules

- All calls go through `lib/api/axios.ts` instances. Never raw `fetch` for API calls.
- `authApi` → auth-service. `chatApi` → chat-service. Two separate instances, two interceptors.
- 401 → refresh once → retry → if fails → `clearAuth()` + redirect `/login`.
- Never put secrets in `NEXT_PUBLIC_*` env vars.

## STOMP Rules

- One singleton client (`lib/stomp/client.ts`). Connect on login, disconnect on logout.
- Subscribe in `useEffect` with cleanup `client.unsubscribe()`.
- On new STOMP message → update TanStack Query cache directly (`queryClient.setQueryData`), do NOT refetch.

## TypeScript

- `strict: true` always.
- No `any`. Use `unknown` + type guard if type is truly unknown.
- API response types in `lib/api/types.ts` — define once, import everywhere.

## Styling

- Tailwind utility classes only. No custom CSS files unless absolutely necessary.
- Dark mode via `next-themes` — use `dark:` prefix classes.
- Mobile-first: default styles for mobile, `md:` / `lg:` for larger screens.

## DO NOT

- Do not use `pages/` router.
- Do not store tokens in localStorage — XSS risk.
- Do not create a new STOMP connection per component.
- Do not call backend from `middleware.ts` — middleware must be fast, use cookie check only.
- Do not use `useEffect` for data fetching — use TanStack Query.
