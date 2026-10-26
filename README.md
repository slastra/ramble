# ramble

Real-time chat with WebRTC video, voice, screen sharing, file uploads, and AI bots.

![A Ramble room: Jordan shares their screen in the main tile, Maya is talking, and the chat has a shared image, a reply from the Skippy bot and Maya typing](docs/screenshots/room.png)

Live: https://ramble.lastra.us

<details>
<summary>More screenshots</summary>

<p align="center">
  <img src="docs/screenshots/join-dark.jpg" width="49%" alt="The join screen in dark mode: drifting contour lines, who's already in the room, and an avatar preview of the name being typed">
  <img src="docs/screenshots/join-light.jpg" width="49%" alt="The same join screen in light mode">
</p>

<p align="center">
  <img src="docs/screenshots/notifications.png" width="98%" alt="Settings, Notifications tab: notifications on for this device, for new messages and joins">
</p>

<p align="center">
  <img src="docs/screenshots/mobile-chat.png" width="30%" alt="Ramble on a phone: the chat">
  <img src="docs/screenshots/mobile-video.png" width="30%" alt="Ramble on a phone: tiles stacked top to bottom, the screen share first">
</p>

</details>

<sub>Screenshots are staged on a local server with made-up people; the screen share is Ramble's own tiling code.</sub>

Ramble is built with Nuxt 4 and LiveKit. People join with just a name, talk over a LiveKit SFU, and chat over its data channels, with AI bots that join the conversation when called.

## Features

### Core functionality
- **WebRTC Communication**: Video, audio, and screen sharing via LiveKit SFU
- **Real-time Messaging**: Data channel-based instant messaging with typing indicators
- **File Sharing**: Upload and share images, videos, audio, documents, and archives
- **DiceBear Avatars**: A face with their initial for each person and a robot face for each bot, generated from the name
- **Name-only Entry**: Join conversations without registration or authentication
- **Device Management**: Split mic/camera buttons with device menus right in the toolbar; choices are remembered and applied when you join
- **Keyboard Shortcuts**: <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>D</kbd> toggles the microphone, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>E</kbd> the camera (same as Google Meet), even while typing
- **Adaptive Streaming**: Dynamic video quality based on network conditions
- **Click-to-Download**: File attachments with original filename preservation
- **Tiling Video Layout**: Hyprland-style dwindle tiling that always fills the panel. Drag a tile onto another to swap, pin one as main, drag the divider to resize the main split; screen shares take the main slot; your arrangement is remembered per browser
- **WHIP Ingress**: Any member can stream from OBS Studio into the room via WHIP; `/ingress` is a fullscreen, watch-only view of the stream

### AI integration
- **Multiple AI Bots**: Configurable bots powered by DeepSeek V4.1 Flash via OpenRouter
- **Natural Language Triggers**: Activate bots by name or trigger word; mention several and each replies in turn, seeing the earlier replies
- **Context-Aware Responses**: Bots see recent conversation history, who's in the room, the local time, and which other bots are around
- **Vision**: Bots see images shared in the chat (newest three, up to 5MB each)
- **Typing Indicator**: "Skippy is typing..." while a reply is being generated
- **Bot Management**: Enable/disable bots through UI; choices persist in localStorage

### User experience
- **Media Controls**: Intuitive controls for camera, microphone, and screen sharing
- **Audio Level Monitoring**: Real-time audio level visualization
- **Sound Notifications**: Customizable sound effects for chat events (messages, joins, leaves, AI responses)
- **Browser Notifications**: Web Push for new messages and joins, per device and opt-in (Settings > Notifications). Arrives with Ramble closed; inside the room, only while its tab is in the background. iPhone/iPad need Ramble added to the Home Screen first
- **Connection Status**: A dot on the logo (hover for details, including desktop-notification status)
- **Who's Here**: Avatar stack in the chat header and an empty-room view that names who's around and offers one-click camera/screen share
- **Responsive Design**: Mobile-friendly interface with Nuxt UI v4 components
- **File Upload Modal**: Drag-and-drop or button-based file selection with progress tracking
- **Rich Media Display**: Inline preview for images, video, and audio files
- **Fullscreen Video**: Immersive fullscreen viewer with overlayed controls for video streams
- **Video Quality Stats**: Real-time statistics overlay showing resolution, framerate, and bitrate
- **Grouped Messages**: Runs from the same sender share one avatar and header (Nuxt UI `UChatMessage`)
- **Jump to Latest**: Reading older messages keeps your place; new ones are counted on a "3 new" button instead of yanking the view
- **Modern Typography**: Inter font family for clean, legible UI text; Geist Mono for code
- **Persistent Identity**: Cookie-based reconnection within 30-second timeout, auto-filled username
- **Device Preferences**: Remember camera, microphone, and speaker selections across sessions
- **Sound Preferences**: Customizable notification sounds with persistent volume and event mapping

## Configuration

Ramble reads its settings from `.env`. The minimum for a local run against a dev-mode LiveKit server:

```bash
LIVEKIT_KEY=devkey
LIVEKIT_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
OPENROUTER_API_KEY=sk-or-...             # for the AI bots
```

[docs/configuration.md](docs/configuration.md) lists every variable (Web Push keys, storage, the ramble-daemon stream) and covers the production LiveKit setup. `.env.example` has the full list.

### Bots

Two bots ship by default in `content/bots/`: **Columbo** (`columbo.yaml`) and **Skippy** (`skippy.yaml`, tuned toward *Expeditionary Force* canon). Add more by creating YAML files:

```yaml
# content/bots/assistant.yaml
name: "Assistant"
role: "Helpful Assistant"
triggers: [assistant, help]
shyness: 0.5            # 0 = always interjects, 1 = never interjects
temperature:            # 0-1 range
  normal: 0.7           # Used when @mentioned or trigger word matches
  interjection: 0.85    # Used for random interjections
personality:
  normal: "You are a helpful assistant..."
  interjection: "..."
# Optional: pin this bot to a specific OpenRouter model id.
# Defaults to OPENROUTER_MODEL env var. Must accept `temperature` and allow
# reasoning to be disabled (e.g. not z-ai/glm-5.3-flash or minimax/minimax-m3.1-flash).
# model: "anthropic/claude-haiku-4.5"
```

## How it works

Media goes through a LiveKit SFU; chat messages, typing indicators and bot replies travel over LiveKit data channels. The Nuxt server mints room tokens, calls OpenRouter for bot replies and posts them into the room, stores uploads, and sends Web Push notifications to people who aren't in the room. An optional native daemon, ramble-daemon, follows an SSE stream of messages and shows desktop notifications while the tab is unfocused.

- [docs/architecture.md](docs/architecture.md): technology stack, composables, avatars, type layout
- [docs/api.md](docs/api.md): every endpoint, its rate limit, and the file upload rules

## Development

Requirements:
- Node.js 22+
- pnpm
- LiveKit Server (for WebRTC functionality)
- OpenRouter API key (for AI bots): https://openrouter.ai/keys
- LiveKit Ingress (optional, for OBS streaming via WHIP)

1. Install dependencies:
```bash
pnpm install
```

2. Start LiveKit server (development mode):
```bash
livekit-server --dev
```

3. (Optional) Start LiveKit Ingress for OBS streaming:
```bash
livekit-ingress --config /path/to/ingress.yaml
```

4. Start Nuxt development server:
```bash
pnpm run dev
```

Application available at `http://localhost:3000`

```bash
pnpm run dev         # Development server
pnpm run build       # Production build
pnpm run preview     # Preview production
pnpm run typecheck   # TypeScript checking
pnpm run lint        # ESLint with auto-fix
```

[docs/changelog.md](docs/changelog.md) has the history of notable changes.

## Deploying

ramble.lastra.us runs on Coolify, built with nixpacks (`nixpacks.toml` pins Node 22 and pnpm 10). Pushing to `main` deploys. To build and run it locally:
```bash
pnpm run build
node .output/server/index.mjs
```

LiveKit runs as its own Coolify app; [docs/configuration.md](docs/configuration.md#production) covers its addresses and keys.

## License

MIT
