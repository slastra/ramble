import type { H3Event } from 'h3'

// Fixed-window counters keyed by bucket and client IP. Ramble runs as one server
// process, so in-memory state is enough to stop a single client from running up
// OpenRouter, spamming notifications, or filling the disk.
interface RateWindow {
  resetAt: number
  used: number
}

const windows = new Map<string, RateWindow>()
let nextSweep = 0

function sweep(now: number) {
  if (now < nextSweep) return
  nextSweep = now + 60_000
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}

/**
 * Charge `cost` against the caller's allowance for `bucket`, or throw 429.
 * Traefik overwrites X-Forwarded-For for untrusted clients, so it's the real address.
 */
export function rateLimit(event: H3Event, bucket: string, limit: number, windowMs: number, cost = 1): void {
  const now = Date.now()
  sweep(now)

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const key = `${bucket}:${ip}`
  let window = windows.get(key)
  if (!window || window.resetAt <= now) {
    window = { resetAt: now + windowMs, used: 0 }
    windows.set(key, window)
  }

  if (window.used + cost > limit) {
    setResponseHeader(event, 'Retry-After', Math.ceil((window.resetAt - now) / 1000))
    throw createError({ statusCode: 429, statusMessage: 'Too many requests, slow down' })
  }
  window.used += cost
}

/** Reject requests that act on a room other than the one the caller's token is for. */
export function assertTokenRoom(event: H3Event, roomName: string): void {
  if (event.context.livekitRoom !== roomName) {
    throw createError({ statusCode: 403, statusMessage: 'Token is not valid for this room' })
  }
}
