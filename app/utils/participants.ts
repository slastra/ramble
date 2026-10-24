// Reserved participant identities that are NOT real chat users. Kept here so the
// producers (the /ingress viewer, the server WHIP ingress) and the consumers
// (chat user list, bot interjection math) stay in sync.

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
