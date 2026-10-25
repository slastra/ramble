import type { PushEndpointRequest } from '#shared/types/push'
import { getPushStore, isPushEnabled, sendPushNotification } from '../../utils/push'

// Send this device a sample notification, so people can see that it works
export default defineEventHandler(async (event) => {
  rateLimit(event, 'push-test', 5, 60_000)
  if (!isPushEnabled()) throw createError({ statusCode: 503, statusMessage: 'Notifications are not set up on this server' })

  const { endpoint } = await readBody<PushEndpointRequest>(event)
  const subscriber = typeof endpoint === 'string' ? await getPushStore().get(endpoint) : undefined
  if (!subscriber) throw createError({ statusCode: 404, statusMessage: 'Notifications are not on for this device' })

  await sendPushNotification(subscriber, {
    title: 'Ramble',
    body: 'Notifications are working. You\'ll hear from the room while you\'re away.',
    tag: 'test',
    url: '/'
  }, 'messages')
  return { success: true }
})
