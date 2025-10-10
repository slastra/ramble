# Ramble Daemon Integration Plan

## Overview
Integrate the ramble-daemon with the Nuxt Ramble web app to enable native Linux desktop notifications with smart suppression based on app focus/visibility.

## Architecture Integration

The daemon expects HTTP POST requests from the web app to:
- `POST http://localhost:9001/active` - App is focused/active
- `POST http://localhost:9001/inactive` - App is closed/unfocused
- `POST http://localhost:9001/heartbeat` - Keep-alive every ~10-20 seconds

## Implementation Steps

### 1. Create Daemon Composable (`app/composables/useDaemonSync.ts`)
Create a new composable to manage daemon communication:
- Track browser visibility via `document.visibilityState` API
- Track window focus via `window` focus/blur events
- Send appropriate status to daemon (active/inactive/heartbeat)
- Handle daemon connection errors gracefully (daemon may not be running)
- Auto-reconnect logic with exponential backoff

**Key features:**
- Heartbeat interval: 15 seconds (well under 30s timeout)
- Only communicate when daemon is detected/running
- Browser-native visibility detection (no polling)

### 2. Integrate in Chat Page (`app/pages/chat.vue`)
Initialize the daemon sync composable when chat page mounts:
- Call `useDaemonSync()` to start tracking
- Automatically cleanup on unmount
- Pass current username for context (optional)

### 3. Environment Configuration (`.env`)
Add optional daemon configuration:
```env
# Ramble Daemon Integration (optional)
NUXT_PUBLIC_DAEMON_URL=http://localhost:9001
NUXT_PUBLIC_DAEMON_ENABLED=true
```

### 4. Runtime Config Update (`nuxt.config.ts`)
Add daemon config to public runtime config:
```typescript
public: {
  // ... existing config
  daemonUrl: process.env.NUXT_PUBLIC_DAEMON_URL || 'http://localhost:9001',
  daemonEnabled: process.env.NUXT_PUBLIC_DAEMON_ENABLED === 'true'
}
```

### 5. Update Documentation
- Add daemon integration section to CLAUDE.md
- Include setup instructions in README.md
- Document environment variables in .env.example

## Technical Details

### Activity Detection Logic
```
IF document.hidden (tab not visible):
  → Send /inactive
ELSE IF window.focused:
  → Send /active + heartbeat every 15s
ELSE:
  → Send /inactive
```

### Error Handling
- Silently fail if daemon not running (don't break app)
- Log errors to console (debug only)
- No user-facing errors for daemon issues
- Graceful degradation

### State Transitions
1. **Page Load**: Detect if visible/focused → send active/inactive
2. **Tab Switch Away**: `visibilitychange` → send inactive
3. **Tab Switch Back**: `visibilitychange` → send active
4. **Window Blur**: `blur` event → send inactive
5. **Window Focus**: `focus` event → send active
6. **Heartbeat**: Every 15s while active

## Benefits
- ✅ No LiveKit/server-side changes needed
- ✅ Purely client-side integration
- ✅ Optional feature (graceful degradation)
- ✅ Works with existing daemon implementation
- ✅ Minimal performance impact (event-driven)
- ✅ Follows Ramble's ephemeral philosophy (no server state)

## Testing Plan
1. Start daemon with test config
2. Open Ramble web app
3. Verify daemon receives "active" status
4. Switch to another tab → verify "inactive"
5. Switch back → verify "active" + heartbeat
6. Close daemon → verify app continues working
7. Restart daemon → verify reconnection

## Daemon Setup

### Prerequisites
The ramble-daemon must be installed and configured:

```bash
# Build the daemon (from ramble-daemon directory)
cargo build --release

# Run setup to create config
./target/release/ramble-daemon setup

# Edit config at ~/.config/ramble/config.toml
# Set server_url to your Ramble Nitro server URL
```

### Configuration
The daemon config (`~/.config/ramble/config.toml`) should point to the Ramble Nitro server:

```toml
username = "your-username"
server_url = "https://your-ramble-server.com"  # Or http://localhost:3000 for dev
local_port = 9001
log_level = "info"
```

### Running the Daemon
```bash
# Start the daemon
./target/release/ramble-daemon

# Or install and use systemd (see ramble-daemon README.md)
```

## Implementation Code Snippets

### useDaemonSync.ts (Composable)
```typescript
export function useDaemonSync() {
  const config = useRuntimeConfig()
  const daemonUrl = config.public.daemonUrl
  const enabled = config.public.daemonEnabled

  let heartbeatInterval: NodeJS.Timeout | null = null
  let isActive = false

  async function sendStatus(endpoint: 'active' | 'inactive' | 'heartbeat') {
    if (!enabled) return

    try {
      await $fetch(`${daemonUrl}/${endpoint}`, {
        method: 'POST',
        timeout: 1000 // Short timeout
      })
    } catch {
      // Silently fail if daemon not running
    }
  }

  function setActive() {
    if (isActive) return
    isActive = true
    sendStatus('active')

    // Start heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    heartbeatInterval = setInterval(() => sendStatus('heartbeat'), 15000)
  }

  function setInactive() {
    if (!isActive) return
    isActive = false
    sendStatus('inactive')

    // Stop heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  function checkVisibility() {
    if (document.hidden) {
      setInactive()
    } else {
      setActive()
    }
  }

  // Setup event listeners
  onMounted(() => {
    if (!enabled) return

    document.addEventListener('visibilitychange', checkVisibility)
    window.addEventListener('focus', setActive)
    window.addEventListener('blur', setInactive)

    // Initial check
    checkVisibility()
  })

  onUnmounted(() => {
    if (!enabled) return

    document.removeEventListener('visibilitychange', checkVisibility)
    window.removeEventListener('focus', setActive)
    window.removeEventListener('blur', setInactive)

    if (heartbeatInterval) clearInterval(heartbeatInterval)

    // Send final inactive
    sendStatus('inactive')
  })
}
```

### chat.vue Integration
```typescript
// In <script setup>
const { userName } = useUser()

// Initialize daemon sync
useDaemonSync()
```

## Server-Sent Events (SSE) Integration

The daemon connects to the Ramble Nitro server to receive chat messages via SSE. The web app already uses LiveKit for real-time messaging, so the daemon needs to connect to a separate SSE endpoint.

### Required Server Endpoint

Create a new SSE endpoint in the Nitro server:

```typescript
// server/api/events.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const username = query.username as string

  if (!username) {
    throw createError({
      statusCode: 400,
      message: 'Username is required'
    })
  }

  // Set SSE headers
  setHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  // TODO: Implement SSE event streaming
  // This should listen to your message bus (LiveKit data channels, Redis, etc.)
  // and forward messages to connected SSE clients

  return sendStream(event, readableStream)
})
```

**Note**: The exact implementation depends on how Ramble stores/broadcasts messages. Options:
1. Listen to LiveKit data channels server-side
2. Use a message bus (Redis pub/sub, etc.)
3. Hook into existing message storage/broadcast system

## Alternative: WebSocket to SSE Bridge

If modifying the Nitro server is not desired, create a separate bridge service that:
1. Connects to LiveKit room as a hidden participant
2. Listens to data channel messages
3. Broadcasts to SSE clients

This keeps the daemon separate from the main Ramble application.
