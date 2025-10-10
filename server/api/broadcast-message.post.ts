import { getMessageBus } from '../utils/messageBus'

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
      message: 'Missing required fields: author, content, room'
    })
  }

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

  return { success: true }
})
