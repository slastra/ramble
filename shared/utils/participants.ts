// Reserved participant identities that are NOT real chat users. Kept here (shared by
// client and server) so the producers (the /ingress viewer, the server WHIP ingress)
// and the consumers (chat user list, bot interjection math, bot room roster) stay in sync.

/** Fixed identity of the OBS/WHIP ingress stream (server: whip-ingress.post.ts). */
export const OBS_STREAM_IDENTITY = 'obs-stream'

/** Identity prefix for passive, view-only participants from the /ingress page. */
export const VIEWER_IDENTITY_PREFIX = 'Viewer-'

/** AI bots join with this identity prefix. */
export const BOT_IDENTITY_PREFIX = 'ai-'

/**
 * True for participants that should be hidden from the chat user list and
 * excluded from the participant count that drives bot interjection probability:
 * AI bots, the OBS ingress stream, and passive /ingress viewers.
 */
export function isHiddenFromChat(identity: string | undefined): boolean {
  if (!identity) return false
  return identity.startsWith(BOT_IDENTITY_PREFIX)
    || identity === OBS_STREAM_IDENTITY
    || identity.startsWith(VIEWER_IDENTITY_PREFIX)
}

/**
 * True for identities only the server may hand out: the OBS ingress stream and AI
 * bots. Case-insensitive so lookalikes such as "OBS-Stream" can't pose as them.
 */
export function isReservedIdentity(identity: string): boolean {
  const lower = identity.toLowerCase()
  return lower === OBS_STREAM_IDENTITY || lower.startsWith(BOT_IDENTITY_PREFIX)
}

/** True for /ingress viewers, who get a watch-only token. */
export function isViewerIdentity(identity: string): boolean {
  return identity.startsWith(VIEWER_IDENTITY_PREFIX)
}
