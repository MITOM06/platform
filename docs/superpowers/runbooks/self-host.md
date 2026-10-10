# PON Self-Host Runbook (one deployment = one company)

This stands up the entire PON platform on a single host, on one domain with TLS.

## 1. Prerequisites
- A Linux host with Docker Engine + Docker Compose v2.
- For real HTTPS: a DNS **A record** for your domain → this host's public IP, ports 80/443 open.
- For a local test: use `DOMAIN=localhost` (browser will warn about Caddy's internal CA).
- An Anthropic API key (required). Optional: Voyage AI key (RAG embeddings), Notion / Google OAuth apps, SMTP.

## 2. Configure
```bash
git clone <repo> && cd <repo>/infra/docker-compose
./bootstrap.sh        # creates .env, generates JWT/vault/internal secrets
```
Then edit `.env` and fill the **HUMAN MUST SET** section: `DOMAIN`, `ACME_EMAIL`,
`WORKSPACE_NAME`, `BOOTSTRAP_OWNER_EMAIL`, `ANTHROPIC_API_KEY` (+ optional creds).
Re-run `./bootstrap.sh` — it validates required vars and never changes existing secrets.

### Connector OAuth redirect URIs
If you set Notion/Google creds, register these redirect URIs in their consoles:
- `https://<DOMAIN>/api/connector/oauth/notion/callback`
- `https://<DOMAIN>/api/connector/oauth/gmail/callback`
- `https://<DOMAIN>/api/connector/oauth/calendar/callback`

## 3. Launch
```bash
docker compose -f compose.prod.yml up -d --build
```
First boot: auth-service seeds the singleton Workspace + preset roles. The
`mongo-setup` one-shot initiates the replica set.

## 4. Become Owner
1. Open `https://<DOMAIN>/register` and sign up with the **exact** `BOOTSTRAP_OWNER_EMAIL`.
2. Restart auth-service once so the bootstrap step assigns the Owner role:
   `docker compose -f compose.prod.yml restart auth-service`
   (Bootstrap only promotes the matching email if it exists and has no role yet.)
3. Log in → the **Admin** entry appears; `/admin` is reachable.

## 5. Verify
```bash
docker compose -f compose.prod.yml ps         # all services Up/healthy
curl -fsS https://<DOMAIN>/api/auth/health     # {"status":...}
```
- `https://<DOMAIN>` loads the web app and you can log in.
- `/admin/workspace`, `/admin/members`, `/admin/roles` render for the Owner.
- Connect a connector at `/integrations`, then in chat ask the assistant to use it.

## 6. Mobile build (optional)
Point the Flutter app at this deployment at build time:
```bash
cd apps/client
flutter build apk --flavor prod --dart-define=PON_DOMAIN=<DOMAIN>     # or build ios / appbundle
```
Without `PON_DOMAIN` the app targets the default Cloud Run hosting.

## 7. Enterprise SSO (optional, OIDC)
1. Create an OIDC app in your IdP (Google Workspace / Entra / Okta / Keycloak).
   Register the redirect URI: `https://<DOMAIN>/api/auth/oidc/callback`.
2. In `.env` set `OIDC_ENABLED=true`, `OIDC_ISSUER` (the IdP discovery/issuer URL),
   `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`. Adjust `OIDC_GROUPS_CLAIM` if your IdP
   names the groups claim differently (Azure may require a manifest/Graph mapping;
   Google Workspace needs a custom claim — it does not emit `groups` by default).
3. Restart: `docker compose -f compose.prod.yml up -d auth-service`.
4. As Owner, open `/admin` → SSO: toggle **Enabled**, optionally set allowed email
   domains, and map IdP group names → roles / departments.
5. Log out → the login page now shows **Sign in with SSO**. First SSO login creates
   the user (linked by verified email) and applies the group mapping. Password login
   keeps working; the bootstrap Owner is never demoted by group mapping (break-glass).

## 8. Notes
- ai-service is an internal worker (RabbitMQ/Redis) — not exposed; no public port.
- `localhost` TLS uses Caddy's internal CA (browser warning) — fine for testing.
- Logs: `docker compose -f compose.prod.yml logs -f <service>`.
- This kit is single-company by design. Multi-company scale-out (Helm, branding,
  feature flags) is deferred — see `docs/superpowers/specs/2026-06-21-p7-self-host-deployment-kit-design.md` §8.

## Cuộc gọi & Phòng họp (LiveKit)

LiveKit chạy cùng stack (`livekit` trong `compose.prod.yml`). Cần thêm:

1. **DNS:** bản ghi A `rtc.<DOMAIN>` trỏ về **cùng IP** với `<DOMAIN>` (nếu dùng Cloudflare
   thì để *DNS only* — proxy của Cloudflare không chuyển UDP).
2. **Firewall máy chủ:** mở `443/tcp` (đã có), `7881/tcp`, `3478/udp`, `50000-60000/udp`.
   **Không** mở `7880` ra ngoài — Caddy đã proxy nó qua `rtc.<DOMAIN>`. Dải relay TURN
   (`30000-40000/udp`, mặc định của LiveKit) chỉ dùng nội bộ, không cần mở.
   LiveKit chạy bằng host networking nên Caddy (trong bridge Docker) gọi nó qua cổng `7880`
   của host — firewall default-deny (ufw / firewalld) sẽ chặn lượt này và `rtc.<DOMAIN>` trả
   502. Cho phép **riêng** dải bridge Docker, vẫn chặn Internet:
   ```bash
   sudo ufw allow from 172.16.0.0/12 to any port 7880 proto tcp
   # firewalld: sudo firewall-cmd --permanent --zone=trusted --add-source=172.16.0.0/12 && sudo firewall-cmd --reload
   ```
3. **Nâng cấp một bản cài có sẵn:** chạy lại `./bootstrap.sh` **trước** `docker compose up` —
   nó chỉ sinh thêm `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` còn thiếu, không đổi secret cũ.
   Thiếu bước này thì `docker compose up` dừng với lỗi `LIVEKIT_API_KEY ... run bootstrap.sh`
   và **cả stack** không khởi động.
4. **Bật cho cuộc gọi:** `CALL_TRANSPORT=sfu` trong `.env`, rồi
   `docker compose -f compose.prod.yml up -d chat-service`. Quay lại P2P: đặt `mesh`.
   Phòng họp luôn dùng LiveKit, không cần cờ.
5. **Kiểm tra:** `curl -s https://rtc.<DOMAIN>` trả `OK`; log
   `docker compose -f compose.prod.yml logs livekit` có dòng `starting LiveKit server` và
   không có lỗi `port`/`TURN`.
