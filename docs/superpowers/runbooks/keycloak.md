# Keycloak cho SSO production (Mac mini)

PON đăng nhập SSO qua chuẩn **OpenID Connect (OIDC)** với bất kỳ IdP (identity provider, hệ
thống đăng nhập của công ty) nào. Runbook này dựng **Keycloak** làm IdP đó, chạy trên chính
Mac mini, đi ra Internet qua Cloudflare Tunnel giống API.

Code PON không đổi: production chỉ cần thêm cấu hình. Các file:

| File | Vai trò |
|---|---|
| `infra/keycloak/compose.keycloak.yml` | Stack riêng `pon-sso`: Keycloak 26.7.5 (chế độ `start`) + Postgres |
| `infra/keycloak/realm-pon.json` | Realm `pon` tạo ở **lần chạy đầu**: client `pon-auth`, nhóm `staff` / `admins`, chính sách mật khẩu, chống dò mật khẩu, SMTP. **Không có tài khoản nào** |
| `infra/keycloak/.env.keycloak.example` | Mẫu biến môi trường → chép thành `.env.keycloak` (gitignored) |
| `infra/keycloak/check.sh` | Kiểm tra Keycloak và PON khớp nhau (issuer, redirect URI, nút SSO…) |
| `infra/docker-compose/compose.mini.yml` | auth-service đọc thêm `OIDC_*` (để trống = tắt, như hiện nay) |

```
trình duyệt ──► https://sso.<domain> ──(Cloudflare)──► cloudflared ──► keycloak:8080 ──► keycloak-db
auth-service ──(discovery + đổi code lấy token, HTTPS)──► https://sso.<domain>/realms/pon
```

Không dùng lại `scripts/dev/keycloak/` (nhánh `dev`): bản đó là `start-dev`, database H2 trong
container, `admin/admin`, client secret `pon-dev-only` công khai và tài khoản test.

| | Dev (`scripts/dev/keycloak/`) | Production (`infra/keycloak/`) |
|---|---|---|
| Chế độ | `start-dev` | `start` (hostname chặt, cache bật) |
| Database | H2 trong container | Postgres, volume `keycloak_db` |
| Địa chỉ | `http://keycloak.localhost:8180` | `https://<SSO_DOMAIN>` qua tunnel |
| Admin | `admin` / `admin` | admin tạm sinh ngẫu nhiên → đổi sang admin cá nhân, có OTP |
| Client secret | `pon-dev-only` | `openssl rand -hex 32` |
| Tài khoản | alice, bob, carol | không có, admin tạo cho người thật |
| HTTPS | tắt (`sslRequired: none`) | `external` |
| Quên mật khẩu / xác minh email | không | có (SMTP) |
| Chống dò mật khẩu, chính sách mật khẩu | tắt | bật (5 lần sai, ≥ 12 ký tự…) |
| Username | gõ tay | chính là email |

## Thứ tự triển khai

1. **Merge nhánh này vào `main`.** Mini tự cập nhật. Vì `OIDC_ENABLED` còn trống nên SSO vẫn
   tắt, production không đổi gì.
2. Làm các bước một lần dưới đây trên mini.
3. Bật SSO trong trang Quản trị của PON.

## Cài đặt một lần

**0. Điều kiện.** Stack `pon-mini` đang chạy (`docker network ls | grep pon-mini_app-net` phải có
kết quả), tunnel kiểu named (`CF_TUNNEL_TOKEN` trong `.env.mini`), domain nằm trên Cloudflare,
**VM Docker** (không phải RAM máy) còn trống ≥ 1,3 GB: Docker Desktop trên mini là một VM ~3,8 GiB
dùng chung cho mọi stack, xem bằng `docker stats --no-stream`. Keycloak bị giới hạn `mem_limit: 1g`,
Postgres `256m`. Thiếu thì tăng *Memory limit* trong Docker Desktop → Settings → Resources
(phải restart Docker = mọi container trên mini tắt ~1 phút).

**1. Điền `.env.keycloak`.**
```bash
cd infra/keycloak
cp .env.keycloak.example .env.keycloak && chmod 600 .env.keycloak
openssl rand -base64 24   # → KC_BOOTSTRAP_ADMIN_PASSWORD
openssl rand -hex 24      # → KC_DB_PASSWORD
openssl rand -hex 32      # → OIDC_CLIENT_SECRET (giữ lại, bước 5 dùng đúng giá trị này)
$EDITOR .env.keycloak
```
`PON_API_BASE` và `WEB_ORIGIN` chép từ `.env.mini`. SMTP dùng chung tài khoản với `MAIL_*` của PON.

**2. Thêm hostname cho tunnel.** Zero Trust → Networks → Tunnels → `pon` → *Public Hostname* →
*Add*:

| Field | Value |
|---|---|
| Subdomain | `sso` (= phần đầu của `SSO_DOMAIN`) |
| Domain | domain của bạn |
| Service | `HTTP` → `keycloak:8080` |

`keycloak` là alias của container trên mạng `pon-mini_app-net`, nơi cloudflared đang chạy.

**3. Khởi động.**
```bash
cd infra/keycloak
docker compose -f compose.keycloak.yml --env-file .env.keycloak up -d
docker compose -f compose.keycloak.yml --env-file .env.keycloak ps    # keycloak: healthy
```
Lần đầu mất 1–2 phút (Keycloak build và tạo bảng trong Postgres). Lỗi thì xem
`docker compose -f compose.keycloak.yml --env-file .env.keycloak logs -f keycloak`.

**4. Khoá phía quản trị** (làm ngay, trước khi báo ai địa chỉ này).
1. Mở `https://<SSO_DOMAIN>/admin/`, đăng nhập bằng admin tạm (`KC_BOOTSTRAP_ADMIN_USERNAME`).
2. Realm **master** → Users → *Add user* cho chính bạn (email thật) → Credentials → đặt mật khẩu
   mạnh → Role mapping → *Assign role* → `admin`. Ở *Required user actions* chọn **Configure OTP**.
3. Đăng xuất, đăng nhập lại bằng admin cá nhân (cài OTP), rồi **xoá** user `bootstrap-admin`.
   Biến `KC_BOOTSTRAP_ADMIN_*` chỉ được dùng khi realm master chưa có user nào, nên để lại trong
   `.env.keycloak` (chmod 600) cũng vô hại.
4. **Cloudflare Access** cho trang quản trị: Zero Trust → Access → Applications → *Add* →
   *Self-hosted*, domain `<SSO_DOMAIN>`, hai path `admin` và `realms/master` → policy *Allow*,
   *Emails* = những người quản trị. Từ đó trang admin hỏi email Cloudflare trước khi tới Keycloak.
   `check.sh` cảnh báo (vàng) nếu `/admin/` vẫn mở cho mọi người.
5. Realm **pon** → Realm settings → **User profile** → `email` → *Who can edit* chỉ để **Admin**.
   Như vậy nhân viên không tự đổi email của mình sang email của người khác được.

**5. Nối PON.** Trong `infra/docker-compose/.env.mini`:
```bash
OIDC_ENABLED=true
OIDC_ISSUER=https://<SSO_DOMAIN>/realms/pon
OIDC_CLIENT_ID=pon-auth
OIDC_CLIENT_SECRET=<đúng giá trị trong .env.keycloak>
OIDC_GROUPS_CLAIM=groups
```
Rồi `./scripts/mini/up.sh`: compose tạo lại auth-service với cấu hình mới.

**6. Kiểm tra.**
```bash
./infra/keycloak/check.sh https://<SSO_DOMAIN> https://<api host>
```
Lúc này dòng "PON reports SSO off" còn đỏ là đúng, vì công tắc trong PON chưa bật (bước 7).
Mọi dòng khác phải xanh.

**7. Bật trong PON.** Đăng nhập PON bằng Owner → Quản trị → **SSO**:
- **Enable SSO**: bật.
- **Allowed email domains**: domain email công ty. Để trống thì chỉ người **đã có** tài khoản PON
  mới vào được bằng SSO, PON không tự tạo tài khoản mới.
- **Group → Role**: `staff` → Member, `admins` → Admin. **Default role**: Member. Nếu để trống,
  người bị gỡ khỏi mọi nhóm sẽ **giữ nguyên** vai trò cũ, kể cả Admin.
- **Chưa bật "Bắt buộc SSO"** cho tới khi bước 8 chạy ổn.

Chạy lại `check.sh`: mọi dòng phải xanh.

**8. Thử người đầu tiên.** Keycloak realm **pon** → Users → *Add user*: email, họ tên, **Email
verified** bật (hoặc để người đó tự xác minh qua email), *Join groups* → `staff` → Credentials →
*Set password*, **Temporary** bật. Ở PON bấm "Sign in with SSO": phải vào được, vai trò Member,
và Nhật ký có dòng "Thành viên được cập nhật qua SSO".

## Hằng ngày

- **Thêm người:** Keycloak → Users → *Add user* → nhóm → Credentials (mật khẩu Temporary), hoặc
  *Credential reset* → *Update password* để Keycloak gửi email cho người đó tự đặt.
- **Đổi vai trò:** đổi nhóm trong Keycloak. Có hiệu lực ở lần đăng nhập SSO kế tiếp. Đổi vai trò
  trong PON sẽ bị ánh xạ nhóm ghi đè ở lần SSO sau.
- **Người nghỉ việc:** tắt user trong Keycloak (*Enabled* off) **và** khoá thành viên trong PON.
  PON chưa có back-channel logout, nên tắt ở Keycloak không cắt các phiên PON đang mở.
- **Bắt buộc SSO:** chỉ bật khi mọi người thuộc domain đó đã có tài khoản Keycloak. Owner vẫn
  đăng nhập được bằng mật khẩu (tài khoản phá kính, dùng khi khẩn cấp).

## Sao lưu

Postgres là dữ liệu duy nhất của stack này (người dùng, nhóm, realm). Mất nó là mất toàn bộ tài
khoản SSO.
```bash
cd infra/keycloak
docker compose -f compose.keycloak.yml --env-file .env.keycloak exec -T keycloak-db \
  pg_dump -U keycloak keycloak | gzip > ~/backups/keycloak-$(date +%F).sql.gz
```
Nên chạy hằng ngày (launchd giống `install-autoupdate.sh`) và giữ bản sao ngoài mini. Khôi phục:
```bash
gunzip -c keycloak-YYYY-MM-DD.sql.gz | docker compose -f compose.keycloak.yml \
  --env-file .env.keycloak exec -T keycloak-db psql -U keycloak keycloak
```

## Nâng cấp Keycloak

Stack này **không** đi theo `redeploy.sh`, nên Keycloak chỉ đổi khi có người chủ động đổi. Đọc
release notes → sao lưu → sửa tag image trong `compose.keycloak.yml` → `up -d` → `check.sh`.

## Tắt SSO hoặc quay lại

- **Nhanh nhất:** Quản trị → SSO → tắt *Enable SSO*. Có hiệu lực ngay, mật khẩu PON không bị
  ảnh hưởng.
- **Hẳn:** để trống `OIDC_ENABLED` trong `.env.mini` → `./scripts/mini/up.sh`. Dừng Keycloak bằng
  `docker compose -f compose.keycloak.yml --env-file .env.keycloak down` (volume vẫn giữ).
- ⚠️ Nếu **Bắt buộc SSO** đang bật mà Keycloak sập, mọi người thuộc domain đó (trừ Owner) không
  đăng nhập được. Tắt "Bắt buộc SSO" trước khi bảo trì Keycloak.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `check.sh`: *no discovery document* | Keycloak chưa healthy, hoặc route tunnel trỏ sai | `logs keycloak`; Public Hostname phải là `HTTP` → `keycloak:8080` |
| `check.sh`: *issuer is …, expected …* | `SSO_DOMAIN` khác hostname thật | Sửa `.env.keycloak`, `up -d`; `OIDC_ISSUER` phải bằng đúng issuer đó |
| Trang Keycloak: *Invalid parameter: redirect_uri* | Client được tạo với `PON_API_BASE` khác | Clients → `pon-auth` → *Valid redirect URIs* = `<api>/api/auth/auth/oidc/callback` |
| PON báo không kết nối được SSO (`SSO_UNAVAILABLE`) | auth-service không gọi được issuer | Trên mini: `docker compose -p pon-mini exec auth-service wget -qO- <issuer>/.well-known/openid-configuration` |
| PON báo email chưa xác minh (`OIDC_EMAIL_UNVERIFIED`) | User chưa có *Email verified* | Bật *Email verified*, hoặc để người đó bấm link xác minh |
| PON báo "chưa có quyền truy cập" (`ACCOUNT_NOT_PROVISIONED`) | Danh sách domain trống, người đó chưa có tài khoản PON | Thêm domain vào *Allowed email domains*, hoặc mời họ vào PON trước |
| Keycloak: *HTTPS required* | Header `X-Forwarded-Proto` không tới được Keycloak | Phải có `KC_PROXY_HEADERS=xforwarded` và đi qua tunnel, không gọi thẳng cổng 8080 |
| Sửa `realm-pon.json` mà không thấy đổi | File chỉ được nhập ở **lần chạy đầu** | Sửa trong admin console. Muốn nhập lại từ đầu thì xoá realm trước (mất user) |
| `network pon-mini_app-net not found` | Stack `pon-mini` chưa chạy | `./scripts/mini/up.sh` trước, rồi mới `up -d` stack này |
