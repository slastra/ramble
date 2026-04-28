# Ramble

Real-time chat application built with Nuxt 4 and LiveKit, featuring WebRTC-based video, audio, screen sharing, instant messaging, file sharing, and AI bot integration with DiceBear avatars.

## Features

### Core Functionality
- **WebRTC Communication**: Video, audio, and screen sharing via LiveKit SFU
- **Real-time Messaging**: Data channel-based instant messaging with typing indicators
- **File Sharing**: Upload and share images, videos, audio, documents, and archives
- **DiceBear Avatars**: Unique geometric avatar generation using identicon style
- **Name-only Entry**: Join conversations without registration or authentication
- **Device Management**: Camera, microphone, and speaker selection with live switching
- **Adaptive Streaming**: Dynamic video quality based on network conditions
- **Click-to-Download**: File attachments with original filename preservation
- **GridStack Video Layout**: Draggable, resizable video tiles with persistent positions
- **WHIP Ingress**: Stream from OBS Studio directly to LiveKit rooms via WHIP protocol

### AI Integration
- **Multiple AI Bots**: Configurable bots powered by Claude Haiku 4.5 via AWS Bedrock
- **Natural Language Triggers**: Activate bots via @mentions
- **Context-Aware Responses**: Bots use conversation history for relevant responses
- **Bot Management**: Enable/disable bots through UI with persistent state

### User Experience
- **Media Controls**: Intuitive controls for camera, microphone, and screen sharing
- **Audio Level Monitoring**: Real-time audio level visualization
- **Sound Notifications**: Customizable sound effects for chat events (messages, joins, leaves, AI responses)
- **Push Notifications**: ntfy.sh integration for message notifications when away
- **Connection Status**: Real-time connection state indicators
- **Responsive Design**: Mobile-friendly interface with Nuxt UI v4 components
- **File Upload Modal**: Drag-and-drop or button-based file selection with progress tracking
- **Rich Media Display**: Inline preview for images, video, and audio files
- **Fullscreen Video**: Immersive fullscreen viewer with overlayed controls for video streams
- **Video Quality Stats**: Real-time statistics overlay showing resolution, framerate, and bitrate
- **Scroll to Bottom**: Auto-appearing button when scrolling up, smart auto-scroll behavior
- **Modern Typography**: Inter font family for clean, legible UI text; Geist Mono for code
- **Persistent Identity**: Cookie-based reconnection within 30-second timeout, auto-filled username
- **Device Preferences**: Remember camera, microphone, and speaker selections across sessions
- **Sound Preferences**: Customizable notification sounds with persistent volume and event mapping

## Technology Stack

See `package.json` for exact versions.

- **Framework**: Nuxt 4 + Vue 3 + TypeScript
- **WebRTC**: LiveKit Client + Server SDK (SFU architecture)
- **UI Library**: Nuxt UI v4
- **Typography**: Nuxt Fonts with Inter and Geist Mono (Google Fonts)
- **Avatars**: DiceBear (identicon style)
- **AI Provider**: Claude (Anthropic) via AWS Bedrock — Haiku 4.5 by default
- **Real-time**: LiveKit data channels for messaging
- **File Storage**: nuxt-file-storage with date-based directory structure
- **Video Layout**: GridStack for draggable video tiles
- **Notifications**: ntfy.sh integration (push) + optional ramble-daemon (native desktop)
- **Package Manager**: pnpm

## Setup

### Prerequisites
- Node.js 22+
- pnpm
- LiveKit Server (for WebRTC functionality)
- AWS account with Bedrock access (for AI bots) — credentials picked up from the standard chain (`~/.aws/credentials`, env vars, IAM role). Haiku 4.5 requires the `us.` cross-region inference profile (already the default).
- LiveKit Ingress (optional, for OBS streaming via WHIP)

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment:
```bash
# .env
AWS_REGION=us-east-1                                         # AWS region for Bedrock
BEDROCK_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0    # Bedrock model/inference profile
# AWS credentials are picked up from the standard chain (~/.aws/credentials, env vars, IAM role)
LIVEKIT_KEY=devkey                       # LiveKit API key (use 'devkey' for dev mode)
LIVEKIT_SECRET=secret                    # LiveKit API secret (use 'secret' for dev mode)
LIVEKIT_URL=ws://localhost:7880          # LiveKit server URL (dev mode)
NUXT_PUBLIC_SITE_URL=https://lastra.us   # Production URL
NTFY_TOPIC=your-ntfy-topic               # ntfy.sh topic for notifications
MY_USERNAME=your-username                # Your username to filter self-notifications
FILE_STORAGE_MOUNT=./uploads             # File storage directory (optional, defaults to ./uploads)
```

### Development

1. Start LiveKit server (development mode):
```bash
livekit-server --dev
```

2. (Optional) Start LiveKit Ingress for OBS streaming:
```bash
livekit-ingress --config /path/to/ingress.yaml
```

3. Start Nuxt development server:
```bash
pnpm run dev
```

Application available at `http://localhost:3000`

### Production

Build and deploy:
```bash
pnpm run build
pnpm run preview
```

## LiveKit Configuration

### Development Mode
```bash
livekit-server --dev
# Dashboard: http://localhost:7880
# WebSocket: ws://localhost:7880
```

### Production Configuration
```yaml
# /etc/livekit/config.yaml
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  your-api-key: your-api-secret
webhook:
  api_key: your-api-key
```

### Reverse Proxy (Caddy)
```
livekit.lastra.us {
    reverse_proxy localhost:7880
}
```

## Bot Configuration

Create YAML files in `content/bots/`:

```yaml
# content/bots/assistant.yaml
name: "Assistant"
role: "Helpful Assistant"
triggers: [assistant, help]
shyness: 0.5            # 0 = always interjects, 1 = never interjects
temperature:            # 0-1 range (Anthropic API)
  normal: 0.7           # Used when @mentioned or trigger word matches
  interjection: 0.85    # Used for random interjections
personality:
  normal: "You are a helpful assistant..."
  interjection: "..."
# Optional: pin to a specific Bedrock model/inference profile for this bot.
# Defaults to BEDROCK_MODEL env var.
# model: "us.anthropic.claude-sonnet-4-6-20250929-v1:0"
```

## Commands

```bash
pnpm run dev         # Development server
pnpm run build       # Production build
pnpm run preview     # Preview production
pnpm run typecheck   # TypeScript checking
pnpm run lint        # ESLint with auto-fix
```

## API Endpoints

### LiveKit & Identity
- `POST /api/livekit-token` — Generate room access tokens
- `POST /api/whip-ingress` — Create/retrieve WHIP ingress for OBS streaming
- `POST /api/validate-username` — Check username availability (recognizes returning users via clientId)
- `POST /api/cleanup-room` — Force-clean stale rooms

### Bots
- `GET /api/bots` — List bot configurations from `content/bots/*.yaml`
- `POST /api/chat` — Generate a bot reply via Claude/Bedrock and post it to the room. Body: `{roomName, userName, content, botName, isInterjection, context}`. Bot enable/disable is fully client-side (localStorage).
- `POST /api/broadcast-message` — Server-initiated room broadcast

### Files
- `POST /api/upload` — Upload with MIME validation and size limits
- `GET /api/download/[...path]` — Download with original filename preserved

### Notifications
- `POST /api/notify` — Send ntfy.sh push notification
- `GET /api/ntfy-config` — Returns the public ntfy URL/topic for the client
- `GET /api/events?username=X` — SSE stream of room messages for the ramble-daemon

## File Upload System

### Supported File Types
- **Images**: JPEG, PNG, GIF, WebP, SVG (max 10MB)
- **Audio**: MP3, WAV, OGG, M4A, WebM (max 25MB)
- **Video**: MP4, WebM, MOV (max 100MB)
- **Documents**: PDF, DOC, DOCX, TXT, MD (max 10MB)
- **Archives**: ZIP, RAR, 7Z, TAR, GZ (max 50MB)

### Storage Structure
Files are organized by upload date using nuxt-file-storage:
```
uploads/
├── 2025/
│   ├── 01/         # January uploads
│   ├── 02/         # February uploads
│   └── ...
└── [year]/[month]/[uuid-timestamp.ext]
```

### File Upload Architecture
- **Module**: nuxt-file-storage for production-ready file handling
- **Upload**: `POST /api/upload` with MIME validation and size limits
- **Download**: `GET /api/download/[...path]` with original filename preservation
- **Security**: Sanitized filenames, validated MIME types, absolute path resolution
- **Environment**: Configurable storage location via `FILE_STORAGE_MOUNT` env variable

## Avatar System

The application uses DiceBear to generate unique identicon-style avatars:
- **Consistent**: Same username always generates the same avatar
- **Unique**: Different usernames create distinct geometric patterns
- **Lightweight**: SVG-based avatars with small file sizes
- **Accessible**: Proper alt text and semantic markup
- **Implementation**: `useDiceBearAvatar` composable with identicon style

## Architecture

### Composables (`app/composables/`)

**LiveKit core:**
- **useLiveKitRoom**: Room connection, media tracks, participant management
- **useLiveKitChat**: Chat messaging via data channels, typing indicators
- **useLiveKitBots**: Bot mention/interjection detection, calls `/api/chat`
- **useAudioLevelMonitoring**: WebAudio analyser + RMS level calculation
- **useDeviceManagement**: Camera/mic/speaker enumeration and `switchActiveDevice` wrapper
- **useParticipantTracking**: Track subscription state and remote participant lifecycle
- **useEventEmitter**: Tiny generic pub-sub used inside the LiveKit composables

**User & UX:**
- **useUser**: Persistent identity (cookie clientId + localStorage username)
- **useBots**: Loads bot configs and runs client-side mention detection
- **useDiceBearAvatar**: Identicon-style avatar URL generator
- **useSoundManager**: Plays notification sounds
- **useSoundSettings**: Sound preference persistence (volume + per-event mapping)
- **useDevicePreferences**: Camera/mic/speaker selection persistence
- **useDaemonSync**: Browser focus/visibility heartbeats to the optional ramble-daemon

### Type Organization
- `/shared/types/` - Types shared between client and server
  - `chat.ts` - Chat message interfaces and conversion utilities
  - `webrtc.ts` - WebRTC-related interfaces
- `/server/types/` - Server-only type definitions
- `/server/constants/` - Shared constants like file type definitions
- `/server/utils/` - Server utilities including LiveKit client singleton

### Recent Updates

**April 2026 — AI provider migration:**
- **Bedrock + Claude**: AI bots now run on Claude Haiku 4.5 via AWS Bedrock (replaces Google Gemini). Credentials via standard AWS chain; no API key in env.
- **Structured chat protocol**: `/api/chat` accepts `{userName, content, botName, isInterjection, context}` instead of a `"Name: content"` string. Removed server-side string parsing.
- **Bot temperature**: now constrained to Anthropic's `0–1` range (was Gemini's `0–2`); schema enforces it.
- **Vestigial fields removed**: `tools` dropped from bot YAML schema; `userCount` and `_isInterjection` removed from `/api/chat`.

**October 2025:**
- **User Preferences**: Cookie-based persistent identity, remembered device selections, sound preferences
- **Reconnection**: Seamless reconnection within 30-second timeout using persistent clientId
- **Enhanced UX**: Auto-filled username with "Welcome back" message, privacy controls
- **WHIP Ingress**: OBS streaming support via WHIP protocol with bypass mode
- **Typography**: Switched to Inter + Geist Mono for modern, clean UI
- **Chat UX**: Scroll-to-bottom button, fixed avatar squishing, improved layout
- **AUR Package**: Published livekit-ingress to Arch User Repository

**September 2025:**
- **Code Reduction**: 755+ lines of dead code removed, 16 files deleted
- **Shared Utilities**: Centralized RoomServiceClient, file type definitions
- **Legacy Removal**: Eliminated bridge layer and defunct slash command system
- **Type Safety**: Shared type definitions replacing redundant conversion layers

## License

MIT
