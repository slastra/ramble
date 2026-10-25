import { Avatar, Style } from '@dicebear/core'
import identiconDefinition from '@dicebear/styles/identicon.json'
import botttsNeutralDefinition from '@dicebear/styles/bottts-neutral.json'

// Styles validate their definition on construction, so build each once and reuse it
const identicon = new Style(identiconDefinition)
const botttsNeutral = new Style(botttsNeutralDefinition)

// Identicons are transparent and run to the edges, so give them a padded pastel tile
// (picked by seed) that survives circular crops and overlapping avatar groups
const IDENTICON_BACKGROUNDS = ['f4e1d6', 'e6ecd8', 'dbe6ef', 'ebdff0', 'f2e8c8', 'dcefe8']

// People get identicons; bots get a robot face, each unique to its name
export function useDiceBearAvatar(seed: string, kind: 'user' | 'bot' = 'user') {
  const avatarDataUri = computed(() => {
    if (!seed) return ''

    const options = { seed: seed.toLowerCase(), size: 128 }
    return kind === 'bot'
      ? new Avatar(botttsNeutral, options).toDataUri()
      : new Avatar(identicon, { ...options, backgroundColor: IDENTICON_BACKGROUNDS, scale: 0.6 }).toDataUri()
  })

  return avatarDataUri
}
