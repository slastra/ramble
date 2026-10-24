import type { BotConfig } from './bots'
import type { ChatMessage } from '../types/chat'
import type { OpenRouterChatRequest, OpenRouterChatResponse, OpenRouterMessage } from '../types/openrouter'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export interface BotResponseOptions {
  bot: BotConfig
  message: ChatMessage
  recentMessages: ChatMessage[]
  isInterjection: boolean
}

const FALLBACKS = [
  'I\'m having trouble thinking right now...',
  'My circuits are a bit fried at the moment.',
  'Can\'t process that right now.',
  'Error 404: Response not found.'
]

function pickFallback(): string {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]!
}

// Some upstream providers (Anthropic among them) require alternating user/assistant
// turns starting with user. Coalesce consecutive same-role messages and drop a
// leading assistant turn so any model routed through OpenRouter accepts the history.
function toMessageHistory(messages: ChatMessage[], botName: string): OpenRouterMessage[] {
  const merged: OpenRouterMessage[] = []
  for (const msg of messages) {
    const isThisBot = msg.type === 'bot' && msg.userName === botName
    const role: OpenRouterMessage['role'] = isThisBot ? 'assistant' : 'user'
    const content = isThisBot ? msg.content : `${msg.userName}: ${msg.content}`
    const last = merged[merged.length - 1]
    if (last && last.role === role) {
      last.content = `${last.content}\n${content}`
    } else {
      merged.push({ role, content })
    }
  }
  if (merged.length > 0 && merged[0]!.role === 'assistant') {
    merged.shift()
  }
  return merged
}

export async function generateBotResponse(options: BotResponseOptions): Promise<string> {
  const { bot, message, recentMessages, isInterjection } = options
  const config = useRuntimeConfig()

  if (!config.openrouterApiKey) {
    console.error('[OpenRouter] OPENROUTER_API_KEY is not set')
    return pickFallback()
  }

  const systemPrompt = isInterjection ? bot.personality.interjection : bot.personality.normal
  const rawTemperature = isInterjection
    ? bot.temperature?.interjection ?? 1.0
    : bot.temperature?.normal ?? 1.0
  const temperature = Math.max(0, Math.min(1, rawTemperature))

  const body: OpenRouterChatRequest = {
    model: bot.model || config.openrouterModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...toMessageHistory([...recentMessages.slice(-10), message], bot.name)
    ],
    max_tokens: 256,
    temperature,
    // Chat replies are short; thinking tokens would eat the max_tokens budget and add latency.
    // Models that require reasoning reject this, so pick a per-bot `model` that can skip it.
    reasoning: { enabled: false }
  }

  try {
    const response = await $fetch<OpenRouterChatResponse>(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openrouterApiKey}`,
        'HTTP-Referer': config.public.siteUrl,
        'X-Title': 'Ramble'
      },
      body,
      timeout: 30000
    })

    const text = response.choices[0]?.message.content?.trim()
    return text || pickFallback()
  } catch (error) {
    console.error(`[OpenRouter] Error generating response for bot ${bot.name}:`, error)
    return pickFallback()
  }
}
