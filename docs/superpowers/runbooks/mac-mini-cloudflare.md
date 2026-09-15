# Runbook — PON backend on a Mac mini, behind Cloudflare Tunnel

Replaces Cloud Run as the place the backend *runs*. Nothing else moves: the
data stays in the same managed services, and the web app stays on Vercel.

```
  Browser ─────► Vercel (Next.js)  ─┐
                                    ├──► https://api.<your-domain>
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

**If the power in your area is unreliable, check FileVault.** With FileVault on,
a mini that loses power stops at the unlock screen: nothing is decrypted, so the
account never logs in, Docker Desktop never starts, and the stack stays down
until somebody types the password in person. `restart: unless-stopped` cannot
help — Docker itself is not running.

```bash
fdesetup status        # "FileVault is Off" is what an unattended server wants
```

The mini holds no data (everything is in the managed tier) so turning FileVault
off costs little and is what makes an unattended reboot actually recover. If you
keep it on, treat every power cut as a manual visit to the machine. A small UPS
is worth more than either option: it turns a flicker into a non-event.

**3. Create the tunnel** (Cloudflare Zero Trust dashboard, one time).

Zero Trust → Networks → Tunnels → *Create a tunnel* → **Cloudflared** → name it
`pon` → the install step shows a **connector token**; copy it, that is
`CF_TUNNEL_TOKEN`. Do not run the docker command it offers — `compose.mini.yml`
runs the connector itself.

Then on the tunnel's *Public Hostname* tab add one route:

| Field | Value |
|---|---|
| Subdomain | `api` |
| Domain | your domain |
| Service | `HTTP` → `caddy:80` |

`caddy` resolves on the compose network, which is why the connector has to be
the one in `compose.mini.yml` rather than a stray `cloudflared` on the host.

Cloudflare creates the DNS record for you. Nothing is port-forwarded and the
mini's IP is never published.

**4. Fill in the environment.**
```bash
cd infra/docker-compose
cp .env.mini.example .env.mini
$EDITOR .env.mini
```
Every value is one the Cloud Run deployment already used — `gh secret list`
names them, though GitHub cannot reveal the values, so take them from the
Atlas / Upstash / CloudAMQP consoles or wherever you stored them.

Three are worth extra care:
- `CF_TUNNEL_TOKEN` / `PON_API_BASE` — the pair that makes the address permanent.
  The token is the connector token from step 3; `PON_API_BASE` is the hostname
  you routed there, e.g. `https://api.example.com`. Setting one without the
  other is refused rather than silently falling back to a quick tunnel.
- `CONNECTOR_VAULT_KEY` — not merely an auth secret. A different key makes every
  stored OAuth token undecryptable and every user has to reconnect every
  connector.
- `RABBITMQ_VHOST` — CloudAMQP gives a *named* vhost. `/` is a valid broker
  vhost with no consumers on it, so the assistant goes silent with no error
  anywhere. `up.sh` refuses to start on `/` for that reason.

**5. Bring it up.**
```bash
./scripts/mini/up.sh
```
It brings up the tunnel and the four services, waits for health, checks the
stack answers through Cloudflare, and prints the three places that need the
hostname on a first run. On a named tunnel it never rewrites `.env.mini`.

## The hostname is fixed

`CF_TUNNEL_TOKEN` in `.env.mini` selects a **named tunnel**: the hostname is the
one routed in the dashboard, `PON_API_BASE` is a constant, and `up.sh` leaves it
alone. A reboot, a `docker compose down`, a power cut — the stack comes back on
the same address and no client is re-pointed. Three places hold a copy of that
hostname and they are touched **once**, on the first run (`up.sh` prints all
three filled in):

| Holder | Set to |
|---|---|
| Vercel `NEXT_PUBLIC_API_BASE` (1 var) | `https://api.<domain>`, then redeploy |
| Flutter `--dart-define=PON_DOMAIN` | `api.<domain>` at build time |
| Google / Notion OAuth consoles | the five callback URLs `up.sh` prints |

`apps/web/lib/config/env.ts` derives all five web base URLs — including
`wss://<host>/ws` — from `NEXT_PUBLIC_API_BASE`, the same way the Flutter client
derives them from `PON_DOMAIN`. **If the old per-service `NEXT_PUBLIC_*_URL`
variables are still set in the Vercel project, delete them**: a per-service
variable wins over the base and pins the app to whatever host it names. The one
that used to be easy to miss was `NEXT_PUBLIC_WS_URL` — without it the client
derived `wss://<vercel-host>/ws`, Vercel does not serve the socket, and realtime
died silently while REST kept working.

### Free-plan limits worth knowing

- **100 MB per upload** through the Cloudflare proxy. Larger file uploads fail
  at the edge, before they reach Caddy.
- **100s timeout on plain HTTP requests.** WebSockets are exempt, so STOMP
  realtime and AI streaming are unaffected.

### Without a domain: quick tunnel

Leave `CF_TUNNEL_TOKEN` blank and `up.sh` falls back to a quick tunnel: free, no
account, no DNS — and a new `*.trycloudflare.com` name on **every start**, which
means re-pointing Vercel (plus a redeploy), rebuilding the Flutter app, and
re-registering the OAuth callbacks by hand each time. Email login, chat,
realtime and AI survive a hostname change once Vercel is redeployed; the OAuth
flows do not, and Google does not accept wildcards. It is a way to try the setup,
not a way to run it.

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
| Tunnel never connects | `docker logs $(docker compose -p pon-mini -f infra/docker-compose/compose.mini.yml ps -q cloudflared)` — a rejected token or no outbound network |
| Tunnel connects, hostname 502s at the edge | the dashboard route points somewhere else: Public Hostname → Service must be `HTTP` → `caddy:80` |
| Stack did not come back after a power cut | FileVault is on and the mini is sitting at the unlock screen, or Docker Desktop is not set to start at login |
| Tunnel answers, service 502s | that service is down: `$C logs <service>` |
| chat-service exits at boot | `ProdEnvironmentGuard` rejected a blank or loopback address — it names the offending variable |
| Assistant silent, no error | `RABBITMQ_VHOST`. Check CloudAMQP shows a consumer on `ai.requests` |
| Everyone logged out after a restart | `REDIS_URL` wrong or pointing somewhere new — sessions and rotating refresh tokens live there |
| `redirect_uri_mismatch` | the callbacks were never registered, or the hostname changed; re-register the five `up.sh` printed |
| Upload of a large file fails at the edge | Cloudflare's free plan caps a request body at 100 MB |

## Cloud Run

`deploy.yml` still targets Cloud Run and will fail while billing is off. It is
left in place deliberately: the two paths are independent, so turning billing
back on restores that deployment without undoing any of this. To silence the
failures meanwhile, disable the *Deploy to Cloud Run* workflow in the Actions
tab — do not delete it.
