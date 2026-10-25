import { readFile } from 'fs/promises'
import type { BotConfig } from './bots'
import { buildRoomContext } from './botContext'
import type { ChatAttachment, ChatMessage } from '../../shared/types/chat'
import type { OpenRouterChatRequest, OpenRouterChatResponse, OpenRouterContentPart, OpenRouterMessage } from '../types/openrouter'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_TOKENS = 400

// Images the bots get to see: the newest few shared in the conversation window.
// Anything older, larger, or in another format stays a "[shared image: …]" note.
const VISION_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export interface BotResponseOptions {
  bot: BotConfig
  history: ChatMessage[] // oldest first; the last entry is what the bot is replying to
  isInterjection: boolean
  room: {
    roster: string[]
    otherBots: string[]
    timeZone?: string
  }
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

// Read an uploaded image ("uploads/YYYY/MM/file") into a data URL the model can see.
async function loadImageDataUrl(attachment: ChatAttachment): Promise<string | null> {
  const [root, year, month, filename] = attachment.url.split('/')
  if (root !== 'uploads' || !year || !month || !filename) return null

  try {
    const data = await readFile(getFileLocally(filename, `/${year}/${month}`))
    return `data:${attachment.mimeType};base64,${data.toString('base64')}`
  } catch (error) {
    console.error(`[OpenRouter] Could not load image ${attachment.url}:`, error)
    return null
  }
}

async function loadRecentImages(messages: ChatMessage[]): Promise<Map<string, string>> {
  const candidates: ChatAttachment[] = []
  for (const msg of messages.slice().reverse()) {
    for (const attachment of parseMessageContent(msg.content).attachments.reverse()) {
      if (candidates.length < MAX_IMAGES
        && VISION_MIME_TYPES.has(attachment.mimeType)
        && attachment.size <= MAX_IMAGE_BYTES) {
        candidates.push(attachment)
      }
    }
  }

  const loaded = await Promise.all(candidates.map(async a => [a.url, await loadImageDataUrl(a)] as const))
  return new Map(loaded.filter((entry): entry is readonly [string, string] => entry[1] !== null))
}

// Some upstream providers (Anthropic among them) require alternating user/assistant
// turns starting with user. Coalesce consecutive same-role messages and drop a
// leading assistant turn so any model routed through OpenRouter accepts the history.
function toMessageHistory(messages: ChatMessage[], botName: string, images: Map<string, string>): OpenRouterMessage[] {
  const turns: { role: 'user' | 'assistant', parts: OpenRouterContentPart[] }[] = []
  for (const msg of messages) {
    const isThisBot = msg.type === 'bot' && msg.userName === botName
    const role = isThisBot ? 'assistant' : 'user'
    const { text, attachments } = parseMessageContent(msg.content)

    const notes = attachments.map(a => `[shared ${a.type}: ${a.originalName}]`)
    const line = isThisBot ? text : [`${msg.userName}: ${text}`.trimEnd(), ...notes].join(' ')
    const parts: OpenRouterContentPart[] = [{ type: 'text', text: line }]
    for (const attachment of attachments) {
      const url = images.get(attachment.url)
      if (url) parts.push({ type: 'image_url', image_url: { url } })
    }

    const last = turns[turns.length - 1]
    if (last && last.role === role) {
      last.parts.push(...parts)
    } else {
      turns.push({ role, parts })
    }
  }
  if (turns.length > 0 && turns[0]!.role === 'assistant') {
    turns.shift()
  }

  return turns.map(({ role, parts }) => {
    const textOnly = parts.every(p => p.type === 'text')
    return {
      role,
      content: textOnly ? parts.map(p => p.type === 'text' ? p.text : '').join('\n') : parts
    }
  })
}

// A reply that hit max_tokens ends mid-thought; cut back to the last full sentence.
function trimToLastSentence(text: string): string {
  const match = text.match(/^[\s\S]*[.!?…](?=\s|$)/)
  return match && match[0].length >= text.length / 2 ? match[0] : `${text.trimEnd()}…`
}

export async function generateBotResponse(options: BotResponseOptions): Promise<string> {
  const { bot, history, isInterjection, room } = options
  const config = useRuntimeConfig()

  if (!config.openrouterApiKey) {
    console.error('[OpenRouter] OPENROUTER_API_KEY is not set')
    return pickFallback()
  }

  const rawTemperature = isInterjection
    ? bot.temperature?.interjection ?? 1.0
    : bot.temperature?.normal ?? 1.0
  const temperature = Math.max(0, Math.min(1, rawTemperature))

  const window = history.slice(-11)
  const images = await loadRecentImages(window)
  const personality = isInterjection ? bot.personality.interjection : bot.personality.normal
  const roomContext = buildRoomContext({ botName: bot.name, ...room, hasImages: images.size > 0 })

  const body: OpenRouterChatRequest = {
    model: bot.model || config.openrouterModel,
    messages: [
      { role: 'system', content: `${personality.trim()}\n\n${roomContext}` },
      ...toMessageHistory(window, bot.name, images)
    ],
    max_tokens: MAX_TOKENS,
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

    const choice = response.choices[0]
    const text = choice?.message.content?.trim()
    if (!text) return pickFallback()
    return choice?.finish_reason === 'length' ? trimToLastSentence(text) : text
  } catch (error) {
    console.error(`[OpenRouter] Error generating response for bot ${bot.name}:`, error)
    return pickFallback()
  }
}
