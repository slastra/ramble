import { Avatar, Style } from '@dicebear/core'
import initialFaceDefinition from '@dicebear/styles/initial-face.json'
import botttsNeutralDefinition from '@dicebear/styles/bottts-neutral.json'

// Styles validate their definition on construction, so build each once and reuse it
const initialFace = new Style(initialFaceDefinition)
const botttsNeutral = new Style(botttsNeutralDefinition)

// People get a little face whose mouth is their initial (on a pastel picked by seed);
// bots get a robot face, each unique to its name
export function useDiceBearAvatar(seed: string, kind: 'user' | 'bot' = 'user') {
  const avatarDataUri = computed(() => {
    if (!seed) return ''

    const options = { seed: seed.toLowerCase(), size: 128 }
    return kind === 'bot'
      ? new Avatar(botttsNeutral, options).toDataUri()
      : new Avatar(initialFace, options).toDataUri()
  })

  return avatarDataUri
}
