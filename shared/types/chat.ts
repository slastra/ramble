// Shared chat message type used by components
// Maps to LiveKitChatMessage but with standardized 'type' field
export interface ChatMessage {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: number
  type: 'user' | 'bot' | 'system'
  status?: 'sent' | 'pending' | 'failed'
  metadata?: {
    botName?: string
    isAI?: boolean
  }
}

// Type helper to convert LiveKitChatMessage to ChatMessage
export function convertToLegacyFormat(lkMessage: {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: number
  type: 'message' | 'bot' | 'system' | 'typing'
  metadata?: { botName?: string, isAI?: boolean }
}): ChatMessage {
  return {
    id: lkMessage.id,
    userId: lkMessage.userId,
    userName: lkMessage.userName,
    content: lkMessage.content,
    timestamp: lkMessage.timestamp,
    type: lkMessage.type === 'message'
      ? 'user'
      : lkMessage.type === 'bot'
        ? 'bot'
        : lkMessage.type === 'system'
          ? 'system'
          : 'user',
    status: 'sent',
    metadata: lkMessage.metadata
  }
}

// File shared in a chat message (produced by /api/upload)
export interface ChatAttachment {
  url: string
  originalName: string
  mimeType: string
  size: number
  type: 'image' | 'video' | 'audio' | 'document' | 'archive'
  uploadedAt: string
}

// Wire format for messages that carry attachments: the message `content` is this
// object JSON-encoded. Plain-text messages are sent as the raw string.
export interface MessageEnvelope {
  type: 'message'
  content: string
  attachments: ChatAttachment[]
}

// One prior message sent to /api/chat as conversation context
export interface BotContextMessage {
  role: 'user' | 'model'
  userName: string
  content: string
}

// Body of POST /api/chat
export interface BotChatRequest {
  roomName: string
  userName: string
  content: string // wire content: plain text or a JSON-encoded MessageEnvelope
  botNames: string[] // bots that should reply, in order; each sees the previous replies
  isInterjection: boolean
  context: BotContextMessage[]
  activeBots?: string[] // every bot enabled for this client, so bots know who else is around
  timeZone?: string // IANA zone of the sender, for the bots' sense of "now"
}

export type BotChatResponse
  = | { success: true, replies: { botName: string, content: string }[] }
    | { success: false, error: string }
