# Runbook — PON backend on a Mac mini, behind Cloudflare Tunnel

Replaces Cloud Run as the place the backend *runs*. Nothing else moves: the
data stays in the same managed services, and the web app stays on Vercel.

```
  Browser ─────► Vercel (Next.js)  ─┐
                                    ├──► https://<name>.trycloudflare.com
  Flutter ──────────────────────────┘              │
                                                   │  Cloudflare edge
                                                   ▼
                                          cloudflared (outbound only)
                                                   │
                                            Caddy :80
                        ┌──────────────┬───────────┴──────┬──────────────┐
                   /api/auth       /api/chat          /api/ai     /api/connector
                        │               │                  │              │
                  auth-service    chat-service        ai-service   connector-service
                        └───────────────┴──────────┬───────┴──────────────┘
                                                   ▼
                        Atlas · Upstash · CloudAMQP · Qdrant Cloud  (unchanged)
```

The mini never opens a port. `cloudflared` dials *out* to Cloudflare and the
edge forwards requests back down that connection, so the home IP is never
published and the router is not touched.

## What this costs in disk

The four backend images total **≈5.6 GB** (auth 1.71 · ai 1.72 · connector 1.73
· chat 0.47), plus ~140 MB for `caddy` and `cloudflared`. Actual on-disk usage
is lower — the three Node images share base layers.

Nothing else is needed on the mini: **no repo clone, no pnpm store, no Maven
repo, no build cache.** Images are built by GitHub Actions on arm64 runners and
pulled. Building on the mini instead would cost roughly 30 GB of toolchain and
cache to produce the same 5.6 GB.

## One-time setup

**1. Docker Desktop** — install, then Settings → General → *Start Docker
Desktop when you sign in*. Under Resources give it at least 6 GB of memory;
chat-service alone is a JVM.

**2. Stop the mini from sleeping.** A sleeping mini is a dead deployment:
```bash
sudo pmset -a sleep 0 disksleep 0 displaysleep 10 womp 1
pmset -g | grep -E ' sleep| womp'      # sleep 0, womp 1
```
`womp 1` brings it back after a power cut; also enable *Start up automatically
after a power failure* in System Settings → Energy.

**3. Fill in the environment.**
```bash
cd infra/docker-compose
cp .env.mini.example .env.mini
$EDITOR .env.mini
```
Every value is one the Cloud Run deployment already used — `gh secret list`
names them, though GitHub cannot reveal the values, so take them from the
Atlas / Upstash / CloudAMQP consoles or wherever you stored them.

Two are worth extra care:
- `CONNECTOR_VAULT_KEY` — not merely an auth secret. A different key makes every
  stored OAuth token undecryptable and every user has to reconnect every
  connector.
- `RABBITMQ_VHOST` — CloudAMQP gives a *named* vhost. `/` is a valid broker
  vhost with no consumers on it, so the assistant goes silent with no error
  anywhere. `up.sh` refuses to start on `/` for that reason.

**4. Bring it up.**
```bash
./scripts/mini/up.sh
```
It starts the tunnel, reads the hostname Cloudflare assigned, writes it back
into `.env.mini`, starts the four services, waits for health, and prints
everything that now needs the new hostname.

## Every restart, the hostname changes

This deployment uses a **quick tunnel**: free, no account resources, no DNS —
and a new `*.trycloudflare.com` name every time `cloudflared` starts. Three
places hold a copy, and `up.sh` prints all three filled in:

| Holder | What breaks until updated |
|---|---|
| Vercel `NEXT_PUBLIC_API_BASE` (1 var) | web talks to a dead host; needs a redeploy |
| Flutter `--dart-define=PON_DOMAIN` | app talks to a dead host; needs a rebuild |
| Google / Notion OAuth consoles | `redirect_uri_mismatch` on social login and connectors |

Email login, chat, realtime and AI keep working through a hostname change once
Vercel is redeployed. Only the OAuth flows need console edits, and Google does
not accept wildcards, so that part is manual.

It used to be five Vercel variables, one of which — `NEXT_PUBLIC_WS_URL` — was
easy to forget: without it the client derived `wss://<vercel-host>/ws`, Vercel
does not serve the socket, and realtime died silently while REST kept working.
`apps/web/lib/config/env.ts` now derives all five (including the socket) from
`NEXT_PUBLIC_API_BASE`, the same way the Flutter client derives them from
`PON_DOMAIN`. **If the old five are still set in the Vercel project, delete
them** — a per-service variable wins over the base and will pin the app to a
dead tunnel. `up.sh` prints the command.

### Making it stop changing

Point a domain at Cloudflare and switch to a **named tunnel**. That is one
command and one token — everything else in `compose.mini.yml` is already
hostname-agnostic:

```bash
cloudflared tunnel login
cloudflared tunnel create pon
cloudflared tunnel route dns pon pon.yourdomain.com
```
Then in `compose.mini.yml` replace the `cloudflared` command with
`["tunnel", "run", "--token", "${CF_TUNNEL_TOKEN}"]`, set
`PON_API_BASE=https://pon.yourdomain.com` in `.env.mini` permanently, and
`up.sh` stops rewriting it. Register the OAuth redirect URIs once and never
again.

## Day-to-day

```bash
./scripts/mini/up.sh              # pull latest images and (re)start
./scripts/mini/up.sh --no-pull    # restart without pulling
./scripts/mini/up.sh --down       # stop everything

C="docker compose -p pon-mini -f infra/docker-compose/compose.mini.yml"
$C ps
$C logs -f ai-service
curl -s localhost:8088/_up        # Caddy directly, bypassing Cloudflare
```

Port 8088 is bound to `127.0.0.1` only — reachable from the mini, not from the
LAN. It is how you tell "the tunnel is broken" from "the service is broken".

### Shipping a code change

Merge to `main` → CI runs → **Build mini images** publishes arm64 images to
GHCR → on the mini `./scripts/mini/up.sh`. The build is chained off CI rather
than off the push, so an image is only published from a commit whose tests
passed.

### Rolling back

Every build is also tagged with its commit sha:
```bash
IMAGE_TAG=<sha> ./scripts/mini/up.sh
```
Put that sha in `IMAGE_TAG` in `.env.mini` to make it stick.

## Troubleshooting

| Symptom | Where to look |
|---|---|
| `up.sh` finds no hostname | `docker logs $(docker compose -p pon-mini -f infra/docker-compose/compose.mini.yml ps -q cloudflared)` — usually no outbound network |
| Tunnel answers, service 502s | that service is down: `$C logs <service>` |
| chat-service exits at boot | `ProdEnvironmentGuard` rejected a blank or loopback address — it names the offending variable |
| Assistant silent, no error | `RABBITMQ_VHOST`. Check CloudAMQP shows a consumer on `ai.requests` |
| Everyone logged out after a restart | `REDIS_URL` wrong or pointing somewhere new — sessions and rotating refresh tokens live there |
| `redirect_uri_mismatch` | hostname changed; re-register the callbacks `up.sh` printed |

## Cloud Run

`deploy.yml` still targets Cloud Run and will fail while billing is off. It is
left in place deliberately: the two paths are independent, so turning billing
back on restores that deployment without undoing any of this. To silence the
failures meanwhile, disable the *Deploy to Cloud Run* workflow in the Actions
tab — do not delete it.
