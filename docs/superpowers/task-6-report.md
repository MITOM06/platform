# Task 6 — Web Test Harness (Vitest + RTL) Report

## Deps Added

| Package | Version | Role |
|---------|---------|------|
| `vitest` | ^4.1.9 | Test runner |
| `@vitejs/plugin-react` | ^6.0.2 | JSX transform for Vitest |
| `@testing-library/react` | ^16.3.2 | Component rendering |
| `@testing-library/jest-dom` | ^6.9.1 | DOM matchers (`toBeInTheDocument`, etc.) |
| `@testing-library/user-event` | ^14.6.1 | User interaction simulation |
| `jsdom` | ^29.1.1 | Browser-like DOM environment |

All added as `devDependencies` in `apps/web/package.json`.

## Config Files

- `apps/web/vitest.config.ts` — Vitest config: `jsdom` environment, globals, `./test/setup.ts`, `@` path alias resolved to `apps/web/`.
- `apps/web/test/setup.ts` — imports `@testing-library/jest-dom/vitest` to extend expect matchers.
- `apps/web/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

## Test Files + Cases

### `apps/web/lib/api/__tests__/axios-refresh.test.ts` (6 tests)

Tests the 401-refresh interceptor attached to `chatApi`.  
Key implementation detail: the interceptor calls bare `axios.post('/api/auth/refresh')` and `apiInstance(config)` for the retry. Both resolve to XHR in jsdom.  
Solution: patch `axios.defaults.adapter` AND `chatApi.defaults.adapter` with a sequential in-memory stub adapter before each test.

| Test case | What it asserts |
|-----------|----------------|
| Sends refresh on 401, retries original with new token | `setAuth` called with `objectContaining({ id: 'u1' })` + new token; retry response is the second stub |
| Clears auth when refresh fails | `clearAuth` called exactly once |
| Does NOT refresh for 401 on `/auth/login` | Zero adapter calls |
| Does NOT refresh when no access token | Zero adapter calls |
| Does NOT retry when `_retry` flag already set | Zero adapter calls |
| Queues second concurrent 401, issues exactly ONE refresh | `refreshCallCount === 1`; both queued requests resolve with retried data after the single refresh |

The concurrent-queue path (`isRefreshing` + `failedQueue` + `processQueue`, lines ~59-65 in `axios.ts`) is now covered. The `setAuth` assertion was strengthened from `expect.anything()` to `expect.objectContaining({ id: 'u1' })` to verify the correct user object is passed.

### `apps/web/components/chat/__tests__/MessageBubble.test.tsx` (9 tests)

Heavy sub-components (MessageActions, modals, media) and hooks (`useNickname`, `useUser`, `next-intl`) are all mocked. `useTranslations` stub returns the i18n key string as-is, making assertions locale-independent.

| Test case | What it asserts |
|-----------|----------------|
| Renders text message content | `screen.getByText('Hello world')` |
| Recalled message shows placeholder, hides content | `'recalled'` visible; original content absent |
| System message mapped via humanizeSystemMessage | `'systemGroupCreated'` present |
| System call message | `'systemVoiceCallMissed'` present |
| AI error content | `'aiError'` present |
| Image content renders ImageContent stub | `data-testid="image-content"` present |
| File content renders FileContent stub | `data-testid="file-content"` present |
| Recalled own message hides content | Same recalled logic for `isOwn: true` |
| Reactions badges render per emoji | `'👍'` and `'❤️'` both visible; `screen.getByText('2')` verifies count badge for 2× 👍 |

## Verify Output

```
pnpm test (apps/web):
  Test Files  2 passed (2)
  Tests       15 passed (15)

pnpm exec tsc --noEmit:
  0 errors

pnpm run lint:
  0 errors, 4 pre-existing warnings (none in test files)
```

## Commit Hash

`0c3a6b58`

## Production-Code Testability Seams

None required. No production code was modified.

## Notes

- The `Not implemented: navigation to another Document` console warning from jsdom appears in the refresh-fail test because `window.location.href = '/login'` is set inside the interceptor's catch block. This is expected jsdom behavior and does not affect test correctness — the test still verifies `clearAuth` was called.
- Vitest v4 emits a Node.js `DEP0205` deprecation about `module.register()` — this is an upstream Vitest/Node 23+ interaction and does not affect functionality.
