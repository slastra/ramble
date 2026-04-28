import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk'
import type Anthropic from '@anthropic-ai/sdk'
import type { BotConfig } from './bots'
import type { ChatMessage } from '../types/chat'

type MessageParam = Anthropic.MessageParam

let bedrockClient: AnthropicBedrock | null = null

function getClient(): AnthropicBedrock {
  if (!bedrockClient) {
    const config = useRuntimeConfig()
    bedrockClient = new AnthropicBedrock({
      awsRegion: config.awsRegion || process.env.AWS_REGION || 'us-east-1'
    })
  }
  return bedrockClient
}

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

// Anthropic requires alternating user/assistant turns starting with user.
// Coalesce consecutive same-role messages and drop a leading assistant turn.
function toMessageHistory(messages: ChatMessage[], botName: string): MessageParam[] {
  const merged: MessageParam[] = []
  for (const msg of messages) {
    const isThisBot = msg.type === 'bot' && msg.userName === botName
    const role: MessageParam['role'] = isThisBot ? 'assistant' : 'user'
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

  const systemPrompt = isInterjection ? bot.personality.interjection : bot.personality.normal
  const rawTemperature = isInterjection
    ? bot.temperature?.interjection ?? 1.0
    : bot.temperature?.normal ?? 1.0
  const temperature = Math.max(0, Math.min(1, rawTemperature))

  const messages = toMessageHistory([...recentMessages.slice(-10), message], bot.name)
  const modelId = bot.model || config.bedrockModel || 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

  try {
    const response = await getClient().messages.create({
      model: modelId,
      max_tokens: 256,
      temperature,
      system: systemPrompt,
      messages
    })

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim()

    return text || pickFallback()
  } catch (error) {
    console.error(`[Claude] Error generating response for bot ${bot.name}:`, error)
    return pickFallback()
  }
}
