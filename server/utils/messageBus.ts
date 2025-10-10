/**
 * Simple in-memory message bus for broadcasting chat messages
 * Used by SSE endpoint to stream messages to connected daemon clients
 */

interface ChatMessageEvent {
  type: 'message' | 'system'
  author: string
  content: string
  room: string
  timestamp: number
}

type MessageHandler = (event: ChatMessageEvent) => void

class MessageBus {
  private handlers: Set<MessageHandler> = new Set()

  /**
   * Subscribe to chat messages
   */
  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler)

    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler)
    }
  }

  /**
   * Publish a chat message to all subscribers
   */
  publish(event: ChatMessageEvent): void {
    this.handlers.forEach((handler) => {
      try {
        handler(event)
      } catch (error) {
        console.error('[MessageBus] Handler error:', error)
      }
    })
  }

  /**
   * Get number of active subscribers
   */
  get subscriberCount(): number {
    return this.handlers.size
  }
}

// Singleton instance
let messageBusInstance: MessageBus | null = null

/**
 * Get or create the message bus singleton
 */
export function getMessageBus(): MessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBus()
  }
  return messageBusInstance
}

export type { ChatMessageEvent, MessageHandler }
