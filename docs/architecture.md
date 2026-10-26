# Architecture

The stack Ramble is built on, the composables that hold the client together, and where the types live.

## Technology stack

See `package.json` for exact versions.

- **Framework**: Nuxt 4 + Vue 3 + TypeScript
- **WebRTC**: LiveKit Client + Server SDK (SFU architecture)
- **UI Library**: Nuxt UI v4
- **Typography**: Nuxt Fonts (Google Fonts): Inter for UI, Geist Mono for code, Cherry Bomb One for branding
- **Avatars**: DiceBear 10 (initial-face for people, bottts-neutral for bots)
- **AI Provider**: OpenRouter (DeepSeek V4.1 Flash by default, any OpenRouter model per bot)
- **Real-time**: LiveKit data channels for messaging
- **File Storage**: nuxt-file-storage with date-based directory structure
- **Video Layout**: Own dwindle tiling (`app/utils/tiling.ts` + `TilingLayout.vue`), no layout library
- **Notifications**: Web Push (`web-push`, VAPID, service worker in `public/sw.js`) + optional ramble-daemon (native desktop)
- **Package Manager**: pnpm (pinned via `packageManager`)
- **Hosting**: Coolify (nixpacks); LiveKit runs as a separate Docker Compose stack

## Avatar system

DiceBear 10 generates every avatar in the browser from the lowercased name:
- **People** get an `initial-face` (their initial as the mouth), **bots** a `bottts-neutral` robot face (rounded square rather than a circle)
- **Consistent**: The same name always produces the same avatar; nothing is stored
- **Lightweight**: Inline SVG data URIs, no network requests
- **Implementation**: `useDiceBearAvatar(name, kind)` where `kind` is `'user'` or `'bot'`

## Composables (`app/composables/`)

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
- **useDiceBearAvatar**: Avatar data URI for a person (initial-face) or bot (bottts-neutral)
- **useSoundManager**: Plays notification sounds
- **useSoundSettings**: Sound preference persistence (volume + per-event mapping)
- **useDevicePreferences**: Camera/mic/speaker selection persistence
- **useDaemonSync**: Browser focus/visibility heartbeats to the optional ramble-daemon
- **usePushNotifications**: Web Push subscribe/unsubscribe, per-device event choices, and notifications for a backgrounded tab

## Type organization

- `/shared/types/` - Types shared between client and server
  - `chat.ts` - Chat message interfaces and conversion utilities
  - `ingress.ts` - WHIP ingress request/response interfaces
  - `index.ts` - Re-exports
- `/shared/utils/` - Helpers used on both sides (`participants.ts` reserved identities, `messageContent.ts` attachment parsing)
- `/server/types/` - Server-only type definitions (`openrouter.ts`, `h3.d.ts` event context)
- `/server/constants/` - Shared constants like file type definitions
- `/server/utils/` - Server utilities: LiveKit client singleton, OpenRouter, bot context, message bus, `guards.ts` (rate limits, room checks)
