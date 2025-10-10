import { getMessageBus, type ChatMessageEvent } from '../utils/messageBus'

interface SseClient {
  id: string
  username: string
  controller: ReadableStreamDefaultController
}

// Store connected SSE clients
const sseClients = new Map<string, SseClient>()

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const username = query.username as string

  if (!username) {
    throw createError({
      statusCode: 400,
      message: 'Username is required'
    })
  }

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable nginx buffering
  })

  // Create unique client ID
  const clientId = `${username}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Get message bus
  const messageBus = getMessageBus()

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Register client
      sseClients.set(clientId, { id: clientId, username, controller })
      console.log(`[SSE] Client connected: ${username} (${clientId}), total: ${sseClients.size}`)

      // Send initial connection message
      const welcomeMessage = `event: system\ndata: ${JSON.stringify({ content: 'Connected to Ramble' })}\n\n`
      controller.enqueue(new TextEncoder().encode(welcomeMessage))

      // Subscribe to message bus
      const unsubscribe = messageBus.subscribe((message: ChatMessageEvent) => {
        try {
          const eventType = message.type
          const sseMessage = `event: ${eventType}\ndata: ${JSON.stringify(message)}\n\n`
          controller.enqueue(new TextEncoder().encode(sseMessage))
        } catch (error) {
          console.error(`[SSE] Failed to send message to client ${clientId}:`, error)
        }
      })

      // Send periodic heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeatInterval)
        }
      }, 30000) // Every 30 seconds

      // Handle client disconnect
      event.node.req.on('close', () => {
        clearInterval(heartbeatInterval)
        unsubscribe()
        sseClients.delete(clientId)
        console.log(`[SSE] Client disconnected: ${username} (${clientId}), remaining: ${sseClients.size}`)
      })
    },
    cancel() {
      sseClients.delete(clientId)
    }
  })

  return sendStream(event, stream)
})
