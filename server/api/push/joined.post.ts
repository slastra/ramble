import { pushToRoom } from '../../utils/push'

// Last time each person's arrival was announced, so a flaky connection or a few reloads
// don't buzz everyone's phone repeatedly
const announced = new Map<string, number>()
const QUIET_FOR = 5 * 60_000

// The joining client calls this once it's connected; people who are away and want joins
// get "<name> joined"
export default defineEventHandler(async (event) => {
  rateLimit(event, 'push-joined', 5, 60_000)
  const identity = event.context.livekitIdentity
  const roomName = event.context.livekitRoom
  if (!identity || !roomName) throw createError({ statusCode: 401, statusMessage: 'Join the room first' })
  if (isHiddenFromChat(identity)) return { success: true }

  const now = Date.now()
  const key = identity.toLowerCase()
  if (now - (announced.get(key) ?? 0) < QUIET_FOR) return { success: true }
  announced.set(key, now)
  for (const [name, at] of announced) {
    if (now - at >= QUIET_FOR) announced.delete(name)
  }

  // Don't hold the joiner's request open while the pushes go out
  pushToRoom(roomName, 'joins', identity, {
    title: 'Ramble',
    body: `${identity} joined the room`,
    tag: 'joins',
    url: '/'
  }).catch(error => console.error('[push] Join notification failed:', error))

  return { success: true }
})
