# GCP Migration Guide — trankhang → giadinhcanglonghoi

> **Mục tiêu**: Chuyển toàn bộ infra từ project cũ sang GCP account mới với $300 credit mới.
> **Thời gian ước tính**: 45–60 phút
> **Downtime**: ~10–15 phút (lúc switch secrets + redeploy)

---

## Tổng quan những gì cần làm

| Bước | Việc | Ghi chú |
|------|------|---------|
| 1 | Tạo GCP project mới | Trên account `giadinhcanglonghoi` |
| 2 | Enable APIs | Cloud Run, Artifact Registry, Compute, IAM |
| 3 | Tạo Artifact Registry | Thay thế registry cũ |
| 4 | Tạo VM mới (Redis + Qdrant) | Hoặc dùng Upstash free (khuyến nghị) |
| 5 | Setup Workload Identity Federation | Cho GitHub Actions auth |
| 6 | Update `deploy.yml` + push | Trigger build trên project mới |
| 7 | Lấy Cloud Run URLs mới | Sau lần deploy đầu |
| 8 | Update callback URLs + deploy lại | Fix OAuth |
| 9 | Update GitHub Secrets | REDIS_URL, QDRANT_URL, WIF credentials |
| 10 | Update frontend (Vercel + Flutter) | Point đến URLs mới |
| 11 | Verify + tắt project cũ | |

---

## Bước 1: Tạo GCP Project mới

1. Vào [console.cloud.google.com](https://console.cloud.google.com) — login bằng `giadinhcanglonghoi`
2. Click **Select a project** → **New Project**
3. Tên: `platform` (hoặc bất kỳ tên gì)
4. Click **Create** → chờ tạo xong
5. **Ghi lại PROJECT_ID** (ví dụ: `platform-abc123`) — sẽ dùng xuyên suốt guide này
6. Vào **Billing** → liên kết thẻ mới → kích hoạt $300 free credit

---

## Bước 2: Enable APIs + Setup gcloud local

```bash
# Login bằng account mới
gcloud auth login

# Set project
gcloud config set project <NEW_PROJECT_ID>

# Enable tất cả APIs cần thiết
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  iamcredentials.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com
```

---

## Bước 3: Tạo Artifact Registry

```bash
gcloud artifacts repositories create platform-app \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description="Platform app Docker images"
```

---

## Bước 4: Setup Redis + Qdrant

### Option A — Upstash (KHUYẾN NGHỊ, free, không cần VM)

1. Vào [upstash.com](https://upstash.com) → đăng ký free
2. Tạo Redis database → Region: Singapore (gần nhất)
3. Copy `REDIS_URL` (format: `rediss://default:password@host:port`)
4. Cho Qdrant: dùng [cloud.qdrant.io](https://cloud.qdrant.io) free tier (1GB)
5. Copy `QDRANT_URL`

→ Không tốn phí VM, không cần quản lý infra.

### Option B — Compute Engine VM (giống setup cũ)

```bash
# Tạo VM e2-micro (nằm trong always-free tier!)
gcloud compute instances create platform-infra \
  --zone=asia-southeast1-b \
  --machine-type=e2-micro \
  --boot-disk-size=20GB \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=redis-server,qdrant-server

# Tạo firewall rules (chỉ cho Cloud Run access)
gcloud compute firewall-rules create allow-redis \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:6379 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=redis-server

gcloud compute firewall-rules create allow-qdrant \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:6333 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=qdrant-server

# Lấy external IP
gcloud compute instances describe platform-infra \
  --zone=asia-southeast1-b \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)'
```

```bash
# SSH vào VM
gcloud compute ssh platform-infra --zone=asia-southeast1-b

# Trong VM: install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Chạy Redis
docker run -d --name redis --restart always -p 6379:6379 redis:7

# Chạy Qdrant
docker run -d --name qdrant --restart always \
  -p 6333:6333 \
  -v qdrant_storage:/qdrant/storage \
  qdrant/qdrant:v1.9.0

# Verify
docker ps
```

Sau đó:
- `REDIS_URL` = `redis://<VM_EXTERNAL_IP>:6379`
- `QDRANT_URL` = `http://<VM_EXTERNAL_IP>:6333`

---

## Bước 5: Setup Workload Identity Federation

```bash
# Lấy project number
export NEW_PROJECT_ID=<NEW_PROJECT_ID>
export PROJECT_NUMBER=$(gcloud projects describe $NEW_PROJECT_ID --format='value(projectNumber)')

echo "Project ID: $NEW_PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"

# Tạo WIF pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Pool"

# Tạo WIF provider (OIDC cho GitHub Actions)
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository=='MITOM06/platform'"

# Tạo Service Account
gcloud iam service-accounts create github-actions-sa \
  --display-name="GitHub Actions SA"

# Bind SA với WIF
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-sa@${NEW_PROJECT_ID}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/MITOM06/platform"

# Grant roles cần thiết
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.admin \
  roles/iam.serviceAccountTokenCreator \
  roles/compute.viewer \
  roles/storage.admin; do
  gcloud projects add-iam-policy-binding $NEW_PROJECT_ID \
    --member="serviceAccount:github-actions-sa@${NEW_PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$ROLE"
done

# Lấy WIF provider name (dùng cho GitHub secret)
gcloud iam workload-identity-pools providers describe github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --format='value(name)'
# Output dạng: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

---

## Bước 6: Update deploy.yml + push lần đầu

Sửa file `.github/workflows/deploy.yml`:

```yaml
env:
  PROJECT_ID: <NEW_PROJECT_ID>          # ← đổi
  REGION: asia-southeast1
  REGISTRY: asia-southeast1-docker.pkg.dev/<NEW_PROJECT_ID>/platform-app  # ← đổi
```

**Lưu ý**: Callback URLs (Google/Facebook/X) sẽ sai ở lần deploy đầu tiên vì chưa biết URL mới. Không sao — deploy trước, lấy URL sau, fix ở Bước 8.

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: migrate to new GCP project"
git push origin main
```

---

## Bước 7: Update GitHub Secrets

Vào **GitHub → Settings → Secrets and variables → Actions** của repo `MITOM06/platform`:

| Secret | Giá trị mới |
|--------|------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Output từ lệnh cuối Bước 5 |
| `GCP_SERVICE_ACCOUNT` | `github-actions-sa@<NEW_PROJECT_ID>.iam.gserviceaccount.com` |
| `REDIS_URL` | URL mới từ Upstash hoặc VM mới |
| `QDRANT_URL` | URL mới từ Qdrant Cloud hoặc VM mới |

Các secrets khác (`JWT_ACCESS_SECRET`, `MONGODB_URI`, `ANTHROPIC_API_KEY`, v.v.) **giữ nguyên, không cần đổi**.

---

## Bước 8: Lấy Cloud Run URLs mới + Update Callbacks

Sau khi pipeline chạy xong (mất ~10 phút), lấy URLs mới:

```bash
gcloud run services describe auth-service \
  --region=asia-southeast1 \
  --format='value(status.url)'
# Ví dụ: https://auth-service-NEWHASH-as.a.run.app
```

Update lại `deploy.yml` — thay toàn bộ `auth-service-ec4ppoccna-as.a.run.app` bằng URL mới:

```yaml
GOOGLE_CALLBACK_URL: https://auth-service-NEWHASH-as.a.run.app/auth/google/callback
FACEBOOK_CALLBACK_URL: https://auth-service-NEWHASH-as.a.run.app/auth/facebook/callback
X_CALLBACK_URL: https://auth-service-NEWHASH-as.a.run.app/auth/x/callback
BASE_URL: https://auth-service-NEWHASH-as.a.run.app
ALLOWED_ORIGINS: https://platform-web-omega-amber.vercel.app,https://auth-service-NEWHASH-as.a.run.app
```

Push lại:
```bash
git add .github/workflows/deploy.yml
git commit -m "fix: update Cloud Run URLs for new project"
git push origin main
```

---

## Bước 9: Update OAuth App Consoles

### Google OAuth
1. Vào [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) — **project cũ**
2. Tìm OAuth 2.0 Client → Edit
3. Thêm vào **Authorized redirect URIs**:
   ```
   https://auth-service-NEWHASH-as.a.run.app/auth/google/callback
   ```

### Facebook
1. Vào [developers.facebook.com](https://developers.facebook.com)
2. Settings → Valid OAuth Redirect URIs → thêm URL mới

### Twitter/X
1. Vào [developer.twitter.com](https://developer.twitter.com)
2. App settings → User authentication settings → Callback URI → thêm URL mới

---

## Bước 10: Update Frontend

### Vercel (Next.js web)
1. Vào Vercel dashboard → project `platform-web`
2. Settings → Environment Variables → cập nhật:
   ```
   NEXT_PUBLIC_AUTH_URL=https://auth-service-NEWHASH-as.a.run.app
   NEXT_PUBLIC_CHAT_URL=https://chat-service-NEWHASH-as.a.run.app
   NEXT_PUBLIC_WS_URL=wss://chat-service-NEWHASH-as.a.run.app/ws
   ```
3. Redeploy

### Flutter app
Tìm và update file config API URLs trong `apps/client/`. Search cho URL cũ `ec4ppoccna`:
```bash
grep -r "ec4ppoccna" apps/client/
```
Cập nhật và build lại app.

---

## Bước 11: Verify + Tắt Project Cũ

```bash
# Verify services đang chạy trên project mới
gcloud run services list --region=asia-southeast1 --project=<NEW_PROJECT_ID>

# Test endpoint
curl https://auth-service-NEWHASH-as.a.run.app/health
```

Sau khi verify ổn:
1. Vào GCP Console project cũ → **Settings → Shut down project**
2. Xác nhận → project tự xóa sau 30 ngày (có thể khôi phục trong thời gian này)

---

## Checklist nhanh

- [ ] Tạo project mới + enable billing
- [ ] Enable APIs
- [ ] Tạo Artifact Registry `platform-app`
- [ ] Setup Redis + Qdrant (Upstash khuyến nghị)
- [ ] Setup Workload Identity Federation
- [ ] Update `deploy.yml` PROJECT_ID + REGISTRY
- [ ] Update GitHub Secrets (WIF provider, SA, Redis URL, Qdrant URL)
- [ ] Push → pipeline chạy xong
- [ ] Lấy Cloud Run URLs mới
- [ ] Update callback URLs trong deploy.yml + push lại
- [ ] Update OAuth consoles (Google, Facebook, X)
- [ ] Update Vercel env vars
- [ ] Update Flutter API URLs
- [ ] Verify tất cả services hoạt động
- [ ] Shutdown project cũ
