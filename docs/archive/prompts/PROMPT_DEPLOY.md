Read CLAUDE.md and infra/docker-compose/compose.yml for context.

We are setting up CI/CD deployment to Google Cloud Run. Two tasks:

## TASK 1 — Update Redis config to support REDIS_URL (Upstash TLS)

Current services use REDIS_HOST + REDIS_PORT separately (works for local Docker).
Production uses Upstash which provides a single `REDIS_URL=rediss://...` (SSL).
Update all 3 services to support both modes: if REDIS_URL is set → use it; else fall back to REDIS_HOST + REDIS_PORT.

### auth-service (NestJS/ioredis)
File: apps/server/auth-service/src/ — find where ioredis client is created (likely in a redis module or app.module.ts)
Change Redis client creation to:
```typescript
const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 })
  : new Redis({
      host: configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(configService.get('REDIS_PORT') || '6379'),
      maxRetriesPerRequest: 3,
    });
```
Also update .env.example to add: REDIS_URL= (optional, overrides REDIS_HOST/PORT)

### ai-service (NestJS/ioredis)  
File: apps/server/ai-service/src/redis/redis.module.ts
Same pattern as auth-service. The module exports REDIS_SUBSCRIBER and REDIS_PUBLISHER tokens.
Update both instances to support REDIS_URL. When using rediss:// URL, ioredis handles TLS automatically.
Also update apps/server/ai-service/.env.example: add REDIS_URL=

### chat-service (Spring Boot)
File: apps/server/chat-service/src/main/resources/application.properties (or application.yml)
Add: spring.data.redis.url=${REDIS_URL:}
When REDIS_URL is set, Spring Boot 3.x parses rediss:// automatically (enables SSL, extracts host/port/password).
When REDIS_URL is empty, existing SPRING_DATA_REDIS_HOST + SPRING_DATA_REDIS_PORT still work.
Spring Boot property priority: spring.data.redis.url overrides host/port when set.

## TASK 2 — Create GitHub Actions CI/CD workflow

Create file: .github/workflows/deploy.yml

Pipeline: push to main → run tests → build Docker images → push to Artifact Registry → deploy to Cloud Run

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

env:
  PROJECT_ID: project-f338c3d2-64dd-47cd-873
  REGION: asia-southeast1
  REGISTRY: asia-southeast1-docker.pkg.dev/project-f338c3d2-64dd-47cd-873/platform-app

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Test auth-service
        run: |
          cd apps/server/auth-service
          pnpm install --frozen-lockfile
          pnpm test --passWithNoTests

      - name: Test ai-service
        run: |
          cd apps/server/ai-service
          pnpm install --frozen-lockfile
          pnpm test --passWithNoTests

      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: 'maven'

      - name: Test chat-service
        run: |
          cd apps/server/chat-service
          ./mvnw test -q

  build-and-deploy:
    name: Build & Deploy
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Setup gcloud
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet

      # Build & push auth-service
      - name: Build auth-service
        run: |
          docker build -t $REGISTRY/auth-service:${{ github.sha }} apps/server/auth-service/
          docker push $REGISTRY/auth-service:${{ github.sha }}

      # Build & push chat-service
      - name: Build chat-service
        run: |
          docker build -t $REGISTRY/chat-service:${{ github.sha }} apps/server/chat-service/
          docker push $REGISTRY/chat-service:${{ github.sha }}

      # Build & push ai-service (context = repo root, dockerfile inside)
      - name: Build ai-service
        run: |
          docker build \
            -t $REGISTRY/ai-service:${{ github.sha }} \
            -f apps/server/ai-service/Dockerfile \
            .
          docker push $REGISTRY/ai-service:${{ github.sha }}

      # Deploy auth-service (scale to zero)
      - name: Deploy auth-service
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: auth-service
          region: ${{ env.REGION }}
          image: ${{ env.REGISTRY }}/auth-service:${{ github.sha }}
          flags: >-
            --allow-unauthenticated
            --min-instances=0
            --max-instances=3
            --memory=512Mi
            --cpu=1
            --port=3001
            --set-env-vars=NODE_ENV=production
          env_vars: |
            JWT_ACCESS_SECRET=${{ secrets.JWT_ACCESS_SECRET }}
            MONGODB_URI=${{ secrets.MONGODB_URI }}
            REDIS_URL=${{ secrets.REDIS_URL }}
            MAIL_HOST=${{ secrets.MAIL_HOST }}
            MAIL_PORT=${{ secrets.MAIL_PORT }}
            MAIL_USER=${{ secrets.MAIL_USER }}
            MAIL_PASS=${{ secrets.MAIL_PASS }}

      # Deploy chat-service (min 1 instance — WebSocket needs persistent connection)
      - name: Deploy chat-service
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: chat-service
          region: ${{ env.REGION }}
          image: ${{ env.REGISTRY }}/chat-service:${{ github.sha }}
          flags: >-
            --allow-unauthenticated
            --min-instances=1
            --max-instances=3
            --memory=1Gi
            --cpu=1
            --port=8080
            --set-env-vars=NODE_ENV=production,SPRING_MAIN_ALLOW_BEAN_DEFINITION_OVERRIDING=true
          env_vars: |
            JWT_ACCESS_SECRET=${{ secrets.JWT_ACCESS_SECRET }}
            SPRING_DATA_MONGODB_URI=${{ secrets.MONGODB_URI }}
            REDIS_URL=${{ secrets.REDIS_URL }}
            MAIL_HOST=${{ secrets.MAIL_HOST }}
            MAIL_PORT=${{ secrets.MAIL_PORT }}
            MAIL_USER=${{ secrets.MAIL_USER }}
            MAIL_PASS=${{ secrets.MAIL_PASS }}
            FIREBASE_SERVICE_ACCOUNT_BASE64=${{ secrets.FIREBASE_SERVICE_ACCOUNT_BASE64 }}

      # Deploy ai-service (scale to zero)
      - name: Deploy ai-service
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ai-service
          region: ${{ env.REGION }}
          image: ${{ env.REGISTRY }}/ai-service:${{ github.sha }}
          flags: >-
            --allow-unauthenticated
            --min-instances=0
            --max-instances=2
            --memory=512Mi
            --cpu=1
            --port=3002
            --set-env-vars=NODE_ENV=production
          env_vars: |
            JWT_ACCESS_SECRET=${{ secrets.JWT_ACCESS_SECRET }}
            MONGODB_URI=${{ secrets.MONGODB_URI }}
            REDIS_URL=${{ secrets.REDIS_URL }}
            ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}
            ANTHROPIC_MODEL=claude-sonnet-4-5
            ANTHROPIC_FALLBACK_MODEL=claude-haiku-4-5-20251001
            OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}
            QDRANT_URL=${{ secrets.QDRANT_URL }}
            AI_BOT_USER_ID=ai-bot-000000000000000000000001
            AI_BOT_DISPLAY_NAME=${{ secrets.AI_BOT_DISPLAY_NAME }}
            REDIS_AI_REQUEST_CHANNEL=ai:request
            REDIS_AI_RESPONSE_PREFIX=ai:response
            AI_MONTHLY_TOKEN_LIMIT=500000

      - name: Print deployed URLs
        run: |
          echo "auth-service: $(gcloud run services describe auth-service --region=$REGION --format='value(status.url)')"
          echo "chat-service: $(gcloud run services describe chat-service --region=$REGION --format='value(status.url)')"
          echo "ai-service: $(gcloud run services describe ai-service --region=$REGION --format='value(status.url)')"
```

After creating deploy.yml, also:
- Create .github/workflows/ directory if it doesn't exist
- Do NOT modify any existing source files beyond the Redis config changes above
- Run: grep -r "REDIS_HOST" apps/server/ to find all places needing update before changing
- Verify the Dockerfiles exist for all 3 services (check apps/server/auth-service/Dockerfile, apps/server/chat-service/Dockerfile, apps/server/ai-service/Dockerfile)
- If any Dockerfile is missing, flag it — do NOT create one without knowing the exact build setup
