import type { InjectionKey } from 'vue'
import type { UseLiveKitRoomReturn } from '../composables/useLiveKitRoom'
import type { UseLiveKitChatReturn } from '../composables/useLiveKitChat'
import type { UseLiveKitBotsReturn } from '../composables/useLiveKitBots'

// pages/chat.vue provides these to everything rendered inside the room
export const LiveKitRoomKey: InjectionKey<UseLiveKitRoomReturn> = Symbol('liveKitRoom')
export const LiveKitChatKey: InjectionKey<UseLiveKitChatReturn> = Symbol('liveKitChat')
export const LiveKitBotsKey: InjectionKey<UseLiveKitBotsReturn> = Symbol('liveKitBots')

/** inject() for the room context: throws if a component is used outside the room page */
export function injectRoomContext<T>(key: InjectionKey<T>): T {
  const value = inject(key)
  if (value === undefined) {
    throw new Error(`${key.description ?? 'Room context'} is only available inside the room page`)
  }
  return value
}
