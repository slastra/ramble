# API

The server endpoints, their rate limits, and how uploaded files are checked and stored.

## Endpoints

Unless marked *public*, an endpoint needs the caller's LiveKit token as `Authorization: Bearer <token>`. Endpoints that take a room only accept the room the token was issued for.

### LiveKit and identity
- `POST /api/livekit-token`: *public*. Issues a 10-minute room token. Refuses the reserved identities `obs-stream` and `ai-*`; `Viewer-*` names (the `/ingress` page) get watch-only tokens
- `POST /api/validate-username`: *public*. Checks a name is free (returning users are recognized by clientId) and not one the user list hides
- `GET /api/room-presence`: *public*. Display names of the people in the room, for the join screen
- `POST /api/whip-ingress`: Creates or returns the room's WHIP ingress (URL + stream key) for OBS
- `POST /api/cleanup-room`: Removes participants that have been disconnected longer than `maxIdleMinutes`

### Bots
- `GET /api/bots`: *public*. Bot configurations from `content/bots/*.yaml`
- `POST /api/chat`: Generate bot replies via OpenRouter and post them to the room. Body: `BotChatRequest` in `shared/types/chat.ts` (`{roomName, userName, content, botNames, isInterjection, context, activeBots?, timeZone?}`); `content` may be a JSON attachment envelope (max 8,000 characters). Returns `{success, replies}`. Bot enable/disable is fully client-side (localStorage).

### Files
- `POST /api/upload`: Upload with MIME validation and per-type size limits; bodies over 150MB are refused
- `GET /api/download/[...path]`: *public*. Download with original filename preserved

### Notifications
- `POST /api/push/subscribe`: Turns notifications on for a device (or refreshes it). The owner is the identity in the caller's LiveKit token; at most 200 devices
- `POST /api/push/unsubscribe`: Turns them off; the subscription endpoint is the proof of ownership
- `POST /api/push/test`: Sends that device a sample notification
- `POST /api/push/joined`: Called by a client once it's connected; pushes "<name> joined" to people who are away (once per person per 5 minutes)
- `POST /api/broadcast-message`: Publishes a sent message to the in-memory bus that feeds `/api/events`, and pushes it to subscribers who aren't in the room
- `GET /api/events?username=X`: SSE stream of every room's messages for ramble-daemon. Requires `Authorization: Bearer <EVENTS_TOKEN>` instead of a LiveKit token

## Rate limits

Tokens are free to mint, so `server/utils/guards.ts` applies per-IP limits (in memory, so they reset on restart). Over the limit, requests get `429` with `Retry-After`.

| Endpoint | Limit |
|---|---|
| `/api/livekit-token` | 20 / minute |
| `/api/validate-username` | 30 / minute |
| `/api/room-presence` | 30 / minute |
| `/api/chat` | 20 / minute |
| `/api/push/subscribe`, `/unsubscribe` | 20 / minute |
| `/api/push/joined` | 5 / minute |
| `/api/push/test` | 5 / minute |
| `/api/broadcast-message` | 60 / minute |
| `/api/upload` | 30 / 10 minutes, and 1GB / hour |
| `/api/whip-ingress`, `/api/cleanup-room` | 10 / minute |

## File uploads

### Supported file types
- **Images**: JPEG, PNG, GIF, WebP (max 10MB); SVG (max 2MB)
- **Audio**: MP3, WAV, OGG, M4A, WebM (max 25MB)
- **Video**: MP4, WebM, MOV (max 100MB)
- **Documents**: PDF, DOC, DOCX (max 10MB); TXT, MD (max 1MB)
- **Archives**: ZIP, RAR, 7Z, TAR, GZ (max 50MB)

### Storage structure
Files are organized by upload date using nuxt-file-storage:
```
uploads/
├── 2025/
│   ├── 01/         # January uploads
│   ├── 02/         # February uploads
│   └── ...
└── [year]/[month]/[uuid-timestamp.ext]
```

### Upload architecture
- **Module**: nuxt-file-storage for production-ready file handling
- **Upload**: `POST /api/upload` with MIME validation and size limits
- **Download**: `GET /api/download/[...path]` with original filename preservation
- **Security**: Sanitized filenames, validated MIME types, absolute path resolution
- **Environment**: Configurable storage location via `FILE_STORAGE_MOUNT` env variable
