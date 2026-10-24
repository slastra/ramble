import { createAvatar } from '@dicebear/core'
import { botttsNeutral, identicon } from '@dicebear/collection'

// People get identicons; bots get a robot face, each unique to its name
export function useDiceBearAvatar(seed: string, kind: 'user' | 'bot' = 'user') {
  const avatarDataUri = computed(() => {
    if (!seed) return ''

    const avatar = kind === 'bot'
      ? createAvatar(botttsNeutral, { seed: seed.toLowerCase(), size: 128 })
      : createAvatar(identicon, { seed: seed.toLowerCase(), size: 128 })

    return avatar.toDataUri()
  })

  return avatarDataUri
}
