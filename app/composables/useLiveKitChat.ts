import { RoomEvent } from 'livekit-client'
import type { RemoteParticipant, Room } from 'livekit-client'
import type { ChatMessage, ChatPacket, TypingPacket } from '../../shared/types/chat'
import type { EventEmitter } from './useEventEmitter'

export interface LiveKitChatEvents {
  messageReceived: [message: ChatMessage]
}

export interface UseLiveKitChatOptions {
  room: Ref<Room | null>
  userId: string
  userName: string
  maxHistorySize?: number
  token?: Ref<string | null>
}

export interface UseLiveKitChatReturn {
  // Chat state
  messages: ComputedRef<ChatMessage[]>
  typingUsers: ComputedRef<string[]>

  // Methods
  sendMessage: (content: string) => Promise<void>
  sendTypingIndicator: (isTyping: boolean) => void
  addLocalSystemMessage: (content: string) => void

  // Events
  on: EventEmitter<LiveKitChatEvents>['on']
  off: EventEmitter<LiveKitChatEvents>['off']
}

export function useLiveKitChat(options: UseLiveKitChatOptions): UseLiveKitChatReturn {
  const { room, userId, userName, maxHistorySize = 1000, token } = options

  // Chat state
  const messageHistory = ref<ChatMessage[]>([])
  const isTyping = ref(false)
  const typingUsersMap = ref<Map<string, { userName: string, timestamp: number }>>(new Map())

  const events = useEventEmitter<LiveKitChatEvents>()

  const messages = computed(() => messageHistory.value)

  const typingUsers = computed(() => {
    const now = Date.now()
    const activeTyping: string[] = []

    // Remove expired typing indicators (older than 3 seconds)
    typingUsersMap.value.forEach((data, userId) => {
      if (now - data.timestamp > 3000) {
        typingUsersMap.value.delete(userId)
      } else {
        activeTyping.push(data.userName)
      }
    })

    return activeTyping
  })

  // Message encoding/decoding
  function encodeMessage(message: ChatPacket): Uint8Array<ArrayBuffer> {
    const jsonString = JSON.stringify(message)
    return new TextEncoder().encode(jsonString)
  }

  function decodeMessage(data: Uint8Array): ChatPacket | null {
    try {
      const jsonString = new TextDecoder().decode(data)
      return JSON.parse(jsonString) as ChatPacket
    } catch (error) {
      console.error('[LiveKit Chat] Failed to decode message:', error)
      return null
    }
  }

  // Generate unique message ID
  function generateMessageId(): string {
    return `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  // Add message to history
  function addMessageToHistory(message: ChatMessage) {
    messageHistory.value.push(message)

    // Limit history size
    if (messageHistory.value.length > maxHistorySize) {
      messageHistory.value = messageHistory.value.slice(-maxHistorySize)
    }

    events.emit('messageReceived', message)
  }

  // Handle incoming data
  function handleDataReceived(data: Uint8Array, _participant?: RemoteParticipant) {
    const message = decodeMessage(data)
    if (!message) return

    // Handle typing indicators
    if (message.type === 'typing') {
      if (message.userId !== userId) { // Don't show our own typing
        if (message.content === 'start') {
          typingUsersMap.value.set(message.userId, {
            userName: message.userName,
            timestamp: Date.now()
          })
        } else if (message.content === 'stop') {
          typingUsersMap.value.delete(message.userId)
        }
      }
      return
    }

    // Skip if we already have this message (by ID) to prevent duplicates
    if (messageHistory.value.some(m => m.id === message.id)) {
      return
    }

    // A real message from someone ends their typing indicator, even if their
    // "stop" packet is lost (people's typing packets are sent lossy)
    typingUsersMap.value.delete(message.userId)

    // Add regular messages to history
    addMessageToHistory(message)

    // Play sound for incoming messages (not for own messages or system messages)
    if (message.userId !== userId && message.type !== 'system') {
      const { playSound } = useSoundManager()
      // Play aiResponse sound for bot messages, messageReceived sound for user messages
      if (message.type === 'bot') {
        playSound('aiResponse')
      } else {
        playSound('messageReceived')
      }
    }
  }

  // Public methods
  async function sendMessage(content: string): Promise<void> {
    if (!room.value) {
      throw new Error('Room not connected')
    }

    const message: ChatMessage = {
      type: 'message',
      id: generateMessageId(),
      userId,
      userName,
      content,
      timestamp: Date.now()
    }

    // Add to local history immediately (sender doesn't receive their own data messages)
    addMessageToHistory(message)

    // Send via reliable data channel
    const encodedMessage = encodeMessage(message)
    await room.value.localParticipant.publishData(encodedMessage, {
      reliable: true,
      destinationIdentities: [] // Send to all participants
    })

    // Broadcast to message bus for SSE clients (daemon notifications)
    // Fire-and-forget, don't wait for response
    $fetch('/api/broadcast-message', {
      method: 'POST',
      headers: token?.value ? { Authorization: `Bearer ${token.value}` } : {},
      body: {
        author: userName,
        content,
        type: message.type,
        room: room.value.name,
        timestamp: message.timestamp
      }
    }).catch(() => {
      // Silently fail if server unavailable
    })

    // Stop typing indicator when sending message
    if (isTyping.value) {
      sendTypingIndicator(false)
    }
  }

  function sendTypingIndicator(typing: boolean): void {
    if (!room.value) return

    isTyping.value = typing

    const typingMessage: TypingPacket = {
      type: 'typing',
      id: generateMessageId(),
      userId,
      userName,
      content: typing ? 'start' : 'stop',
      timestamp: Date.now()
    }

    // Send via unreliable data channel for typing indicators
    const encodedMessage = encodeMessage(typingMessage)
    room.value.localParticipant.publishData(encodedMessage, {
      reliable: false,
      destinationIdentities: []
    }).catch((error) => {
      console.warn('[LiveKit Chat] Failed to send typing indicator:', error)
    })
  }

  function addLocalSystemMessage(content: string): void {
    const message: ChatMessage = {
      type: 'system',
      id: generateMessageId(),
      userId: 'system',
      userName: 'System',
      content,
      timestamp: Date.now()
    }

    // Only add to local history, DON'T publish to room
    addMessageToHistory(message)
  }

  // Named handler for participant disconnect cleanup
  function handleParticipantDisconnected(participant: RemoteParticipant) {
    typingUsersMap.value.delete(participant.identity)
  }

  // Set up room event listeners
  function setupRoomListeners() {
    if (!room.value) return

    // Listen for data messages
    room.value.on(RoomEvent.DataReceived, handleDataReceived)

    // Clean up typing indicators when participants leave
    room.value.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
  }

  // Remove all listeners from a room instance
  function removeRoomListeners(roomInstance: Room) {
    roomInstance.off(RoomEvent.DataReceived, handleDataReceived)
    roomInstance.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
  }

  // Watch for room changes
  const stopRoomWatch = watch(room, (newRoom, oldRoom) => {
    // Remove old listeners if they exist
    if (oldRoom) {
      removeRoomListeners(oldRoom)
    }

    // Set up new listeners
    if (newRoom) {
      setupRoomListeners()
    }
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => {
    if (isTyping.value) {
      sendTypingIndicator(false)
    }
    stopRoomWatch()
    if (room.value) {
      removeRoomListeners(room.value)
    }
  })

  return {
    messages,
    typingUsers,
    sendMessage,
    sendTypingIndicator,
    addLocalSystemMessage,
    on: events.on,
    off: events.off
  }
}
