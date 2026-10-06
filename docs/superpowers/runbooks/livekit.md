# LiveKit media host

Calls (with `CALL_TRANSPORT=sfu`) and meetings send audio/video through LiveKit.
The Mac mini is behind Cloudflare Tunnel, which carries HTTP and WebSocket but
**not UDP**, so LiveKit needs a host with a public IP.

## Phương án khuyến nghị — VPS riêng

1. VPS Linux ~4 vCPU / 4 GB (trần 25 người/phòng), Docker + compose plugin.
2. DNS: `rtc.<domain>` → IP của VPS, **DNS only** (mây xám nếu dùng Cloudflare).
3. Firewall: mở `80/tcp`, `443/tcp`, `7881/tcp`, `3478/udp`, `50000-60000/udp`.
   Không mở `7880`. Dải relay TURN `30000-40000/udp` chỉ dùng nội bộ.
4. Trên VPS:
   ```bash
   git clone <repo> pon && cd pon/infra/livekit
   cp .env.livekit.example .env.livekit   # điền đủ
   docker compose -f compose.livekit.yml --env-file .env.livekit up -d
   ```
5. Trên mini, điền mục LiveKit trong `.env.mini` (`LIVEKIT_URL=wss://rtc.<domain>`, key/secret
   **giống hệt** `.env.livekit`), rồi `scripts/mini/up.sh`.
6. Kiểm tra:
   - `curl -s https://rtc.<domain>` → `OK`.
   - `docker compose -f compose.livekit.yml logs livekit` có `starting LiveKit server`.
   - Log chat-service không có lỗi `ProdEnvironmentGuard`.
   - Sau khi plan Calls/Meetings có client: hai máy khác mạng (một máy 4G) vào cùng phòng,
     nghe/thấy nhau; log chat-service có dòng nhận webhook `participant_joined`.
7. Bật cho cuộc gọi: `CALL_TRANSPORT=sfu` trong `.env.mini` → `scripts/mini/up.sh`.
   Rollback: `CALL_TRANSPORT=mesh`.

## Phương án Mac mini (chỉ khi owner chọn)

Chỉ làm được nếu mạng nhà **không** bị CGNAT: IP WAN trên trang router phải trùng với
`curl -4 ifconfig.me` chạy trên mini (IP dạng `100.64.x.x`–`100.127.x.x` là CGNAT).

- Chạy LiveKit **native** (`brew install livekit` + launchd), không qua Docker Desktop
  (Docker Desktop trên macOS xử lý dải UDP kém — QUIC của cloudflared từng chết im vì lý do này).
- Router: port-forward `7881/tcp`, `3478/udp`, `50000-60000/udp` về mini; DDNS cho
  `rtc.<domain>` (DNS only ⇒ **lộ IP nhà**); bật firewall IPv6 trên router trước.
- Tín hiệu `wss://rtc.<domain>` có thể đi qua Cloudflare Tunnel (thêm ingress), media thì không.
- Viết plan riêng cho phương án này trước khi làm.
