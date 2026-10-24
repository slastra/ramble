import { Avatar, Style } from '@dicebear/core'
import identiconDefinition from '@dicebear/styles/identicon.json'
import botttsNeutralDefinition from '@dicebear/styles/bottts-neutral.json'

// Styles validate their definition on construction, so build each once and reuse it
const identicon = new Style(identiconDefinition)
const botttsNeutral = new Style(botttsNeutralDefinition)

// People get identicons; bots get a robot face, each unique to its name
export function useDiceBearAvatar(seed: string, kind: 'user' | 'bot' = 'user') {
  const avatarDataUri = computed(() => {
    if (!seed) return ''

    const style = kind === 'bot' ? botttsNeutral : identicon
    return new Avatar(style, { seed: seed.toLowerCase(), size: 128 }).toDataUri()
  })

  return avatarDataUri
}
