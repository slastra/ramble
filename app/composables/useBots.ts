import type { BotsCollectionItem } from '@nuxt/content'

// Use the auto-generated type with required shyness and mutable arrays
export interface BotConfig extends Omit<BotsCollectionItem, 'triggers'> {
  shyness: number // Make shyness required
  triggers: string[] // Make triggers mutable
}

const STORAGE_KEY = 'ramble-bots-enabled'

// Load which bots this browser has switched on
const loadBotsEnabled = (): Record<string, boolean> => {
  if (import.meta.server) return {}

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as Record<string, boolean>
  } catch (error) {
    console.warn('Failed to load bot settings:', error)
  }
  return {}
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Client-side composable for bot detection
export const useBots = () => {
  const bots = useState<BotConfig[]>('bots', () => [])
  const botsEnabled = useState<Record<string, boolean>>('botsEnabled', loadBotsEnabled)

  // Save which bots are enabled to localStorage
  const saveBotsEnabled = () => {
    if (import.meta.server) return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(botsEnabled.value))
    } catch (error) {
      console.warn('Failed to save bot settings:', error)
    }
  }

  // Load bots on client
  const loadBots = async () => {
    try {
      const { data } = await $fetch<{ data: BotConfig[] }>('/api/bots')
      bots.value = data || []
      // Initialize all bots as disabled by default
      data?.forEach((bot) => {
        if (botsEnabled.value[bot.name] === undefined) {
          botsEnabled.value[bot.name] = false
        }
      })
    } catch (error) {
      console.error('Failed to load bots:', error)
      // Return empty array if loading fails
      bots.value = []
    }
  }

  // Toggle bot enabled state (client-side only, persisted in localStorage)
  const toggleBot = (botName: string) => {
    botsEnabled.value[botName] = !botsEnabled.value[botName]
    saveBotsEnabled()
  }

  // Check if a bot is enabled
  const isBotEnabled = (botName: string) => {
    return botsEnabled.value[botName] ?? false
  }

  // Every enabled bot the message mentions, in the order they're first mentioned
  const detectBotMentions = (message: string): BotConfig[] => {
    const mentions: { bot: BotConfig, index: number }[] = []
    for (const bot of bots.value) {
      // Skip disabled bots
      if (!isBotEnabled(bot.name)) {
        continue
      }

      const regex = new RegExp(`\\b(${bot.triggers.map(escapeRegExp).join('|')})\\b`, 'i')
      const match = regex.exec(message)
      if (match) {
        mentions.push({ bot, index: match.index })
      }
    }

    return mentions.sort((a, b) => a.index - b.index).map(m => m.bot)
  }

  // Set all bot states (from SSE)
  const setBotStates = (states: Record<string, boolean>) => {
    botsEnabled.value = states
    saveBotsEnabled()
  }

  // Update single bot state (from SSE)
  const updateBotState = (botName: string, enabled: boolean) => {
    botsEnabled.value[botName] = enabled
    saveBotsEnabled()
  }

  return {
    bots: readonly(bots),
    botsEnabled: readonly(botsEnabled),
    loadBots,
    detectBotMentions,
    toggleBot,
    isBotEnabled,
    setBotStates,
    updateBotState
  }
}
