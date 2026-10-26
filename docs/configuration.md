# Configuration

Every environment variable Ramble reads, and how the LiveKit server it talks to is set up. The [README](../README.md#configuration) has the short version.

## Environment

```bash
# .env
OPENROUTER_API_KEY=sk-or-...                                 # OpenRouter API key
OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash-1017          # Default bot model (OpenRouter id)
LIVEKIT_KEY=devkey                       # LiveKit API key (use 'devkey' for dev mode)
LIVEKIT_SECRET=secret                    # LiveKit API secret (use 'secret' for dev mode)
LIVEKIT_URL=ws://localhost:7880          # LiveKit server URL (dev mode)
NUXT_PUBLIC_SITE_URL=https://lastra.us   # Production URL
NUXT_PUBLIC_VAPID_PUBLIC_KEY=...         # Web Push key pair (npx web-push generate-vapid-keys);
VAPID_PRIVATE_KEY=...                    #   notifications are off when unset
VAPID_SUBJECT=https://ramble.lastra.us   # Contact for the push services
DATA_DIR=/app/data                       # Push subscriptions; needs a persistent volume
FILE_STORAGE_MOUNT=./uploads             # File storage directory (optional, defaults to ./uploads)
EVENTS_TOKEN=long-random-string          # ramble-daemon's key to /api/events (stream is off when unset)
NUXT_PUBLIC_DAEMON_URL=http://localhost:9001   # Local ramble-daemon (optional)
NUXT_PUBLIC_DAEMON_ENABLED=true
```

`.env.example` has the full list.

## LiveKit

### Development mode

```bash
livekit-server --dev
# Dashboard: http://localhost:7880
# WebSocket: ws://localhost:7880
```

### Production

Production LiveKit is its own Coolify app, built from the private repo `slastra/livekit`: one `docker-compose.yaml` with livekit-server, the WHIP ingress, and Valkey. It is separate from this app so a Ramble deploy never drops calls in progress.

| Address | Serves |
|---|---|
| `livekit.lastra.us` | signalling and API; `/whip` goes to the ingress |
| `turn.lastra.us:443` | TURN over TLS for clients on restrictive networks (Traefik terminates TLS) |
| 7881/tcp, 50000–60000/udp | WebRTC media |

Ramble's `LIVEKIT_KEY` / `LIVEKIT_SECRET` must match the key pair configured there.
