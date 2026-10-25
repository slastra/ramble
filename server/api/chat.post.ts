import { generateBotResponse } from '../utils/openrouter'
import { loadBots } from '../utils/bots'
import { getRoomRoster } from '../utils/botContext'
import { sendBotMessage, sendBotTyping } from '../utils/livekitBot'
import type { BotChatRequest, BotChatResponse, ChatMessage } from '../../shared/types/chat'

// Strip leading "Name:" prefix the model occasionally emits despite system-prompt guidance.
function stripBotNamePrefix(response: string, botName: string): string {
  const escaped = botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return response.replace(new RegExp(`^\\*{0,2}${escaped}\\*{0,2}\\s*:\\s*`, 'i'), '').trim()
}

export default defineEventHandler(async (event): Promise<BotChatResponse> => {
  const body = await readBody<Partial<BotChatRequest>>(event)
  const { roomName, userName, content, botNames, isInterjection, context, activeBots, timeZone } = body

  if (!roomName || !userName || !content || !Array.isArray(botNames) || botNames.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'roomName, userName, content, and botNames are required'
    })
  }

  const allBots = await loadBots(event)
  const bots = botNames
    .map(name => allBots.find(b => b.name === name))
    .filter(bot => bot !== undefined)
  if (bots.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Bot not found' })
  }

  const now = Date.now()
  const history: ChatMessage[] = (context ?? []).map((msg, i) => ({
    id: `ctx-${now}-${i}`,
    userId: msg.role === 'model' ? `bot-${msg.userName}` : 'user',
    userName: msg.userName,
    content: msg.content,
    timestamp: now,
    type: msg.role === 'model' ? 'bot' : 'user'
  }))
  history.push({
    id: `msg-${now}`,
    userId: 'user',
    userName,
    content,
    timestamp: now,
    type: 'user'
  })

  const roster = await getRoomRoster(roomName)
  const presentBots = [...new Set([...(activeBots ?? []), ...bots.map(b => b.name)])]
  const replies: { botName: string, content: string }[] = []

  // Bots answer one at a time so each later bot sees the earlier replies.
  for (const bot of bots) {
    // Not awaited so the model call starts right away, but the reply waits on it below:
    // otherwise the two LiveKit API calls race and "typing" can land after the reply.
    const typingStarted = sendBotTyping(roomName, bot.name, true).catch(() => {})
    try {
      const response = await generateBotResponse({
        bot,
        history,
        isInterjection: isInterjection ?? false,
        room: {
          roster,
          otherBots: presentBots.filter(name => name !== bot.name),
          timeZone
        }
      })
      const reply = stripBotNamePrefix(response, bot.name)
      await typingStarted
      await sendBotMessage(roomName, bot.name, reply)

      history.push({
        id: `reply-${Date.now()}-${bot.name}`,
        userId: `bot-${bot.name}`,
        userName: bot.name,
        content: reply,
        timestamp: Date.now(),
        type: 'bot'
      })
      replies.push({ botName: bot.name, content: reply })
    } catch (error) {
      console.error(`[chat.post] Failed to deliver ${bot.name}'s response:`, error)
    } finally {
      await typingStarted
      await sendBotTyping(roomName, bot.name, false).catch(() => {})
    }
  }

  return replies.length > 0
    ? { success: true, replies }
    : { success: false, error: 'Bot response failed' }
})
