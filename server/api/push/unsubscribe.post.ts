import type { PushEndpointRequest } from '#shared/types/push'
import { getPushStore } from '../../utils/push'

// Turn notifications off for this device. Knowing the endpoint is the proof of ownership:
// it's a secret URL only the browser and its push service have.
export default defineEventHandler(async (event) => {
  rateLimit(event, 'push-subscribe', 20, 60_000)
  const { endpoint } = await readBody<PushEndpointRequest>(event)
  if (typeof endpoint !== 'string') throw createError({ statusCode: 400, statusMessage: 'Missing endpoint' })
  await getPushStore().remove(endpoint)
  return { success: true }
})
