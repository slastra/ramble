import { generateBotResponse } from '../utils/claude'
import { loadBots } from '../utils/bots'
import { sendBotMessage } from '../utils/livekitBot'
import type { ChatMessage } from '../types/chat'

interface ChatRequestBody {
  roomName?: string
  userName?: string
  content?: string
  botName?: string
  isInterjection?: boolean
  context?: { role: string, userName: string, content: string }[]
}

// Strip leading "Name:" prefix the model occasionally emits despite system-prompt guidance.
function stripBotNamePrefix(response: string, botName: string): string {
  const escaped = botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return response.replace(new RegExp(`^\\*{0,2}${escaped}\\*{0,2}\\s*:\\s*`, 'i'), '').trim()
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatRequestBody>(event)
  const { roomName, userName, content, botName, isInterjection, context } = body

  if (!roomName || !userName || !content || !botName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'roomName, userName, content, and botName are required'
    })
  }

  const bot = (await loadBots(event)).find(b => b.name === botName)
  if (!bot) {
    throw createError({ statusCode: 404, statusMessage: 'Bot not found' })
  }

  const now = Date.now()
  const recentMessages: ChatMessage[] = (context ?? []).map((msg, i) => ({
    id: `ctx-${now}-${i}`,
    userId: msg.role === 'model' ? `bot-${msg.userName}` : 'user',
    userName: msg.userName,
    content: msg.content,
    timestamp: now,
    type: msg.role === 'model' ? 'bot' : 'user'
  }))

  const currentMessage: ChatMessage = {
    id: `msg-${now}`,
    userId: 'user',
    userName,
    content,
    timestamp: now,
    type: 'user'
  }

  try {
    const response = await generateBotResponse({
      bot,
      message: currentMessage,
      recentMessages,
      isInterjection: isInterjection ?? false
    })
    await sendBotMessage(roomName, botName, stripBotNamePrefix(response, botName))
    return { success: true as const }
  } catch (error) {
    console.error('[chat.post] Failed to generate bot response:', error)
    return { success: false as const, error: 'Bot response failed' }
  }
})
