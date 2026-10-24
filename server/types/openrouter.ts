// Subset of OpenRouter's OpenAI-compatible chat completions API that the bots use.
// https://openrouter.ai/docs/api-reference/chat-completion

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterChatRequest {
  model: string
  messages: OpenRouterMessage[]
  max_tokens: number
  temperature: number
  reasoning?: { enabled: boolean }
}

export interface OpenRouterChatResponse {
  id: string
  model: string
  provider?: string
  choices: {
    finish_reason: string | null
    message: { role: 'assistant', content: string | null }
  }[]
}
