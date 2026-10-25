import type { UseLiveKitRoomReturn } from './useLiveKitRoom'

// Speaking ring hysteresis on LiveKit's 0..100 audio level, so it doesn't flicker
const SPEAKING_ON = 4
const SPEAKING_OFF = 2
// Smoothing time constant: ~150ms reads as responsive without jitter
const SMOOTHING_MS = 150

/**
 * Per-participant audio levels for the video tiles: `level(id)` is smoothed to 0..1 for
 * animating the camera-off avatar glow, `isSpeaking(id)` drives the speaking ring.
 * Time-based smoothing keeps the motion steady when the tab is throttled.
 */
export function useSpeakingLevels(liveKitRoom: UseLiveKitRoomReturn, identities: Ref<string[]>) {
  const levels = reactive<Record<string, number>>({})
  const speaking = reactive<Record<string, boolean>>({})

  function rawLevel(identity: string): number {
    const local = liveKitRoom.localParticipant.value
    const value = local?.identity === identity
      ? liveKitRoom.audioLevel.value
      : liveKitRoom.remoteParticipants.value.find(p => p.identity === identity)?.audioLevel ?? 0
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  }

  let frame = 0
  let last = 0
  function tick(now: number) {
    const alpha = 1 - Math.exp(-Math.max(0, now - last) / SMOOTHING_MS)
    last = now
    const present = new Set(identities.value)
    for (const id of present) {
      const raw = rawLevel(id)
      levels[id] = (levels[id] ?? 0) + (raw / 100 - (levels[id] ?? 0)) * alpha
      if (raw > SPEAKING_ON) speaking[id] = true
      else if (raw < SPEAKING_OFF) speaking[id] = false
    }
    for (const id of Object.keys(levels)) {
      if (!present.has(id)) {
        levels[id] = 0
        speaking[id] = false
      }
    }
    frame = requestAnimationFrame(tick)
  }

  onMounted(() => {
    last = performance.now()
    frame = requestAnimationFrame(tick)
  })
  onUnmounted(() => cancelAnimationFrame(frame))

  return {
    level: (identity: string) => levels[identity] ?? 0,
    isSpeaking: (identity: string) => speaking[identity] ?? false
  }
}
