# PROMPT: Deploy Next.js Web to Vercel + Fix CORS

Read `CLAUDE.md` and `apps/web/CLAUDE.md` first.

## Task 1 — Add vercel.json

Create `apps/web/vercel.json`:
```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs"
}
```

## Task 2 — Update chat-service CORS

File: `apps/server/chat-service/src/main/resources/application.yml`

Find the CORS config (allowed origins for WebSocket and REST). Add support for an env var `ALLOWED_ORIGINS` so Vercel URL can be injected at runtime:

The current config likely has `allowed-origins: "*"` or hardcoded localhost. Change to read from env:

```yaml
cors:
  allowed-origins: ${ALLOWED_ORIGINS:http://localhost:3000,http://localhost:3001}
```

Then find wherever `setAllowedOrigins` is called in the Java source (WebSocket config and/or CorsConfig) and update to use this property. Search:
```bash
grep -r "setAllowedOrigins\|allowedOrigins\|CorsConfig\|WebSocketConfig" apps/server/chat-service/src --include="*.java" -l
```

Update the found config class to read `${ALLOWED_ORIGINS}` and split by comma.

## Task 3 — Add ALLOWED_ORIGINS to deploy.yml

File: `.github/workflows/deploy.yml`

In the chat-service `env_vars` block, add:
```yaml
ALLOWED_ORIGINS=https://platform-web.vercel.app,https://auth-service-ec4ppoccna-as.a.run.app
```

Note: Replace `platform-web.vercel.app` with actual Vercel URL after first deploy. For now use placeholder — CORS will be updated after Vercel deploy confirms the URL.

## Task 4 — Verify build locally

```bash
cd apps/web
pnpm build
```

Fix any TypeScript or build errors before committing.

## Task 5 — Commit and push

```bash
git add apps/web/vercel.json apps/server/chat-service/src .github/workflows/deploy.yml
git commit -m "deploy: add vercel.json, configure CORS for production web domain"
git push origin main
```

## After deploy (manual steps — NOT done by Claude)

1. Go to vercel.com → Import Git Repository → select `MITOM06/platform` → set Root Directory to `apps/web`
2. Set env vars in Vercel dashboard:
   - `NEXT_PUBLIC_AUTH_URL` = `https://auth-service-ec4ppoccna-as.a.run.app`
   - `NEXT_PUBLIC_CHAT_URL` = `https://chat-service-ec4ppoccna-as.a.run.app`
   - `NEXT_PUBLIC_WS_URL` = `wss://chat-service-ec4ppoccna-as.a.run.app/ws`
3. After Vercel assigns URL → update `ALLOWED_ORIGINS` in deploy.yml with real domain → push to trigger redeploy
4. Add Vercel URL to Google OAuth Console → Authorized JavaScript origins + redirect URIs
