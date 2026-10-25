// A chat message as it travels over the LiveKit data channel and sits in the client's
// history. Bot replies posted by the server (server/utils/livekitBot.ts) use it too.
// `content` is plain text, or a JSON MessageEnvelope when files are attached.
export interface ChatMessage {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: number
  type: 'message' | 'bot' | 'system'
  metadata?: {
    botName?: string
    isAI?: boolean
  }
}

// "<name> is typing": sent alongside messages but never kept in history
export interface TypingPacket {
  type: 'typing'
  id: string
  userId: string
  userName: string
  content: 'start' | 'stop'
  timestamp: number
}

// Anything that arrives on the chat data channel
export type ChatPacket = ChatMessage | TypingPacket

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
