import { getMessageBus } from '../utils/messageBus'
import { pushToRoom } from '../utils/push'

interface BroadcastMessageBody {
  author: string
  content: string
  type: 'message' | 'bot' | 'system'
  room: string
  timestamp: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<BroadcastMessageBody>(event)

  if (!body.author || !body.content || !body.room) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: author, content, room'
    })
  }
  assertTokenRoom(event, body.room)
  rateLimit(event, 'broadcast', 60, 60_000)

  // Determine event type - convert 'bot' to 'message' for daemon
  let eventType: 'message' | 'system' = 'message'
  if (body.type === 'system') {
    eventType = 'system'
  }

  // Publish to message bus for SSE clients
  const messageBus = getMessageBus()
  messageBus.publish({
    type: eventType,
    author: body.author,
    content: body.content,
    room: body.room,
    timestamp: body.timestamp || Date.now()
  })

  // People who are away and want messages get a notification; the sender's identity comes
  // from their token, not the body
  const sender = event.context.livekitIdentity
  if (body.type === 'message' && sender) {
    pushToRoom(body.room, 'messages', sender, {
      title: sender,
      body: messagePreview(body.content),
      tag: 'chat',
      url: '/'
    }).catch(error => console.error('[push] Message notification failed:', error))
  }

  return { success: true }
})
