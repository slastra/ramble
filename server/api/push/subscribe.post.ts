import type { PushSubscribeRequest } from '#shared/types/push'
import { getPushStore, isPushEnabled } from '../../utils/push'

// Turn notifications on for this device, or refresh it (who it belongs to, which events).
// The identity comes from the caller's LiveKit token, so nobody can subscribe as someone else.
export default defineEventHandler(async (event) => {
  rateLimit(event, 'push-subscribe', 20, 60_000)
  if (!isPushEnabled()) throw createError({ statusCode: 503, statusMessage: 'Notifications are not set up on this server' })

  const identity = event.context.livekitIdentity
  if (!identity) throw createError({ statusCode: 401, statusMessage: 'Join the room first' })

  const { subscription, events } = await readBody<PushSubscribeRequest>(event)
  const { endpoint, keys } = subscription ?? {}
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 1024
    || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string'
    || keys.p256dh.length > 256 || keys.auth.length > 64) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid push subscription' })
  }

  const saved = await getPushStore().upsert({
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    identity,
    events: { messages: events?.messages !== false, joins: events?.joins !== false },
    updatedAt: Date.now()
  })
  if (!saved) throw createError({ statusCode: 507, statusMessage: 'Too many devices have notifications on' })

  return { success: true }
})
