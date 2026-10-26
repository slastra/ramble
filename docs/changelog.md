# Changelog

Notable changes to Ramble, newest first.

**October 2026: LiveKit on Coolify, hardening:**
- **LiveKit**: moved from bare systemd services to a Docker Compose stack on Coolify (`slastra/livekit`) and upgraded 1.9.12 to 1.13.10. TURN over TLS on `turn.lastra.us:443` now works; it never had, because Traefik sent 443 to an HTTP route instead of TURN.
- **Events stream**: `/api/events` requires `EVENTS_TOKEN`; it used to stream every room's messages to anyone with the URL. ramble-daemon sends it as `token` in its config.
- **Identities**: nobody can join as `obs-stream` or `ai-*`; `/ingress` viewers get watch-only tokens.
- **Abuse limits**: per-IP rate limits, room-bound requests, capped `/api/chat` input, and a 150MB upload body limit.
- **Dependencies**: DiceBear 10 (every avatar changed once); lockfile fixes for advisories in h3, ws, socket.io-parser, defu, tiptap, tar and others; pnpm 10.34.8.

**October 2026: OpenRouter:**
- **AI provider**: bots moved from Claude on AWS Bedrock to OpenRouter. Default model is `deepseek/deepseek-v4.1-flash-1017`, picked from a persona bake-off: fastest replies, about 6x cheaper than Haiku 4.5, and it honors per-bot temperature. Set `OPENROUTER_API_KEY`; AWS credentials are no longer used.
- **No SDK**: the server calls OpenRouter's chat completions endpoint with `$fetch`; the `@anthropic-ai/*` packages and the Bedrock IAM script were removed.
- **Chat participants**: the OBS ingress stream and `/ingress` viewers are hidden from the user list and excluded from bot interjection math.
- **Smarter bots**: room awareness (roster, local time, other bots, chat conventions), vision on shared images, a typing indicator, multi-bot mentions answered in sequence, replies trimmed to the last full sentence if they hit the token limit, and per-bot robot avatars.
- **Fixes**: bot on/off toggles now persist across reloads; bot replies now reach the ramble-daemon SSE stream.

**April 2026: AI provider migration:**
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
