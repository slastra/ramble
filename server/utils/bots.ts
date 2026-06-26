// Server-side bot utilities
import type { BotsCollectionItem } from '@nuxt/content'
import type { H3Event } from 'h3'

// Use the auto-generated type from Nuxt Content with required shyness field and mutable arrays
export interface BotConfig extends Omit<BotsCollectionItem, 'triggers'> {
  shyness: number // Make shyness required (not optional)
  triggers: string[] // Make triggers mutable
}

// Cache loaded bots to avoid repeated queries
let cachedBots: BotConfig[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 60000 // 1 minute cache

// Load bots directly from content
export async function loadBots(event?: H3Event): Promise<BotConfig[]> {
  try {
    // Use cache if still valid
    if (cachedBots && Date.now() - cacheTimestamp < CACHE_DURATION) {
      return cachedBots
    }

    // If we have an event context, use queryCollection directly
    if (event) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - queryCollection expects 1 arg but needs 2 in server context
      const bots = await queryCollection(event, 'bots').all()
      const botConfigs = bots.map((bot: BotsCollectionItem) => ({
        ...bot,
        shyness: bot.shyness ?? 0.5,
        triggers: [...bot.triggers] // Make triggers mutable
      }))
      cachedBots = botConfigs
      cacheTimestamp = Date.now()
      return botConfigs
    }

    // Fallback: use cached data or return empty
    return cachedBots || []
  } catch (error) {
    console.error('[bots] Failed to load bots:', error)
    return cachedBots || []
  }
}
