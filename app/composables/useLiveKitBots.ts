import type { UseLiveKitChatReturn } from './useLiveKitChat'
import type { UseLiveKitRoomReturn } from './useLiveKitRoom'
import type { BotConfig } from './useBots'
import type { BotChatRequest, BotChatResponse, BotContextMessage, ChatMessage } from '../../shared/types/chat'

interface UseLiveKitBotsOptions {
  liveKitChat: UseLiveKitChatReturn
  liveKitRoom: UseLiveKitRoomReturn
  userId: string
  userName: string
}

export function useLiveKitBots(options: UseLiveKitBotsOptions) {
  const { liveKitChat, liveKitRoom, userId: _userId, userName } = options

  // Re-use existing bot logic
  const { bots, loadBots, toggleBot, isBotEnabled, detectBotMentions } = useBots()

  // Track bot response state
  const activeBotResponses = ref<Set<string>>(new Set())
  const lastMessages = ref<ChatMessage[]>([])

  // Track timeout IDs for cleanup
  const timeoutIds = ref<Set<NodeJS.Timeout>>(new Set())

  // Calculate interjection probability for a bot
  const calculateInterjectionProbability = (bot: BotConfig, participantCount: number, recentMessages: ChatMessage[]): number => {
    if (!isBotEnabled(bot.name)) return 0

    // Always respond when user is alone (1 participant)
    if (participantCount === 1) return 1.0

    // Don't interrupt if bot just responded
    if (activeBotResponses.value.has(bot.name)) {
      return 0
    }

    // Check recent messages (last 5)
    const recent = recentMessages.slice(-5)

    // Don't respond if bot already responded recently
    const botRecentlyResponded = recent.some(msg =>
      msg.type === 'bot' && msg.metadata?.botName === bot.name
    )
    if (botRecentlyResponded) return 0

    // Base probability decreases with more participants
    // Formula: probability = (1 / (1 + 0.5 * (participantCount - 1))) * (1 - shyness)
    const factor = 0.5
    const baseProbability = 1 / (1 + factor * (participantCount - 1))

    // Apply shyness factor
    let probability = baseProbability * (1 - bot.shyness)

    // Increase probability if bot is mentioned
    const lastMessage = recent[recent.length - 1]
    if (lastMessage && detectBotMentions(lastMessage.content).some(b => b.name === bot.name)) {
      probability = 0.8 // High probability when directly mentioned
    }

    // Increase probability if conversation matches bot interests
    const conversationText = recent.map(m => m.content).join(' ').toLowerCase()
    if (bot.role) {
      const botInterests = bot.role.toLowerCase().split(' ')
      const matchingWords = botInterests.filter((word: string) =>
        word.length > 3 && conversationText.includes(word)
      )
      probability += matchingWords.length * 0.1
    }

    return Math.min(probability, 0.9) // Cap at 90%
  }

  // Check for bot triggers when USER SENDS a message.
  // `text` drives mention detection; `wireContent` is what was actually sent (a JSON
  // envelope when files are attached) so the server can show bots the attachments.
  const checkOutgoingMessage = async (text: string, roomName: string, wireContent: string = text) => {
    const participantCount = liveKitRoom.participantCount.value

    // Capture context BEFORE the new message is added
    // We'll pass this snapshot to avoid including the triggering message in context
    const contextSnapshot = [...lastMessages.value]

    // Check for bot mentions first (always respond to mentions); every mentioned bot answers
    const mentionedBots = detectBotMentions(text)
    if (mentionedBots.length > 0) {
      await triggerBotResponse(mentionedBots, wireContent, roomName, true, contextSnapshot)
      return
    }

    // When user is alone, always trigger a random bot
    if (participantCount === 1) {
      const enabledBots = bots.value.filter(bot => isBotEnabled(bot.name))
      if (enabledBots.length > 0) {
        const randomBot = enabledBots[Math.floor(Math.random() * enabledBots.length)]
        await triggerBotResponse([randomBot as BotConfig], wireContent, roomName, false, contextSnapshot)
        return
      }
    }

    // For multiple participants, check interjection probability
    for (const bot of bots.value) {
      if (!isBotEnabled(bot.name)) continue

      const probability = calculateInterjectionProbability(bot as BotConfig, participantCount, contextSnapshot)
      if (Math.random() < probability) {
        await triggerBotResponse([bot as BotConfig], wireContent, roomName, false, contextSnapshot)
        break // Only one bot responds
      }
    }
  }

  // Call bot API with user's context. Multiple bots reply in order on the server.
  const triggerBotResponse = async (
    respondingBots: BotConfig[],
    userMessage: string,
    roomName: string,
    isMention: boolean,
    contextMessages?: ChatMessage[]
  ) => {
    try {
      // Mark bots as actively responding
      respondingBots.forEach(bot => activeBotResponses.value.add(bot.name))

      // Use the provided context snapshot if available
      // Otherwise, use current history but exclude the very last message if it matches what we're responding to
      let messagesForContext = contextMessages || lastMessages.value

      // If using current history and the last message matches what triggered the bot, exclude it
      if (!contextMessages && messagesForContext.length > 0) {
        const lastMsg = messagesForContext[messagesForContext.length - 1]
        if (lastMsg && lastMsg.content === userMessage && lastMsg.userName === userName) {
          messagesForContext = messagesForContext.slice(0, -1)
        }
      }

      const context: BotContextMessage[] = messagesForContext.slice(-10).map(msg => ({
        role: msg.type === 'bot' ? 'model' : 'user',
        userName: msg.userName,
        content: msg.content
      }))

      // Note: Current message is NOT added here - server handles it to avoid duplication
      const body: BotChatRequest = {
        roomName,
        userName,
        content: userMessage,
        context,
        botNames: respondingBots.map(bot => bot.name),
        isInterjection: !isMention,
        activeBots: bots.value.filter(bot => isBotEnabled(bot.name)).map(bot => bot.name),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }

      await $fetch<BotChatResponse>('/api/chat', {
        method: 'POST',
        headers: liveKitRoom.livekitToken.value ? { Authorization: `Bearer ${liveKitRoom.livekitToken.value}` } : {},
        body
      })
    } catch (error) {
      console.error(`[LiveKit Bots] Failed to trigger bot response:`, error)
    } finally {
      // Clear active response after delay
      const timeoutId = setTimeout(() => {
        respondingBots.forEach(bot => activeBotResponses.value.delete(bot.name))
        timeoutIds.value.delete(timeoutId)
      }, 5000) // 5 second cooldown
      timeoutIds.value.add(timeoutId)
    }
  }

  // Only track incoming messages for history (don't trigger bots)
  const trackIncomingMessage = (message: ChatMessage) => {
    // Update message history for all messages
    // We need to track our own messages too for context continuity
    lastMessages.value.push(message)
    if (lastMessages.value.length > 20) {
      lastMessages.value = lastMessages.value.slice(-20)
    }
  }

  const startListening = () => {
    liveKitChat.on('messageReceived', trackIncomingMessage)
  }

  const stopListening = () => {
    liveKitChat.off('messageReceived', trackIncomingMessage)
  }

  // Initialize bots
  onMounted(async () => {
    await loadBots()
    startListening()
  })

  // Cleanup
  onUnmounted(() => {
    stopListening()
    // Clear all pending timeouts
    timeoutIds.value.forEach(clearTimeout)
    timeoutIds.value.clear()
  })

  return {
    // Bot state
    bots,
    activeBotResponses: readonly(activeBotResponses),

    // Bot controls
    toggleBot,
    isBotEnabled,
    detectBotMentions,

    // Export for ChatInput
    checkOutgoingMessage,

    // Lifecycle
    startListening,
    stopListening
  }
}

export type UseLiveKitBotsReturn = ReturnType<typeof useLiveKitBots>
