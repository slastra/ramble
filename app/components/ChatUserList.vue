<script setup lang="ts">
import type { UseLiveKitRoomReturn } from '../composables/useLiveKitRoom'
import type { UseLiveKitChatReturn } from '../composables/useLiveKitChat'

const liveKitRoom = inject('liveKitRoom') as UseLiveKitRoomReturn
const liveKitChat = inject('liveKitChat') as UseLiveKitChatReturn
const { bots, toggleBot, isBotEnabled } = useBots()
const { members } = useRoomMembers(liveKitRoom)

const avatar = (name: string, kind: 'user' | 'bot' = 'user') => ({
  src: useDiceBearAvatar(name, kind).value,
  alt: name
})

const isTyping = (name: string) => liveKitChat?.typingUsers.value?.includes(name) || false
</script>

<template>
  <div class="space-y-4">
    <section>
      <h3 class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        In the room · {{ members.length }}
      </h3>
      <ul class="space-y-2.5">
        <li
          v-for="member in members"
          :key="member.identity"
          class="flex items-center justify-between gap-2"
        >
          <UUser
            :name="member.isLocal ? `${member.name} (you)` : member.name"
            :description="isTyping(member.name) ? 'typing…' : undefined"
            :avatar="avatar(member.name)"
            size="sm"
          />
          <div class="flex items-center gap-1.5 text-dimmed">
            <UIcon
              v-if="member.participant.isScreenShareEnabled"
              name="i-lucide-screen-share"
              class="size-4 text-primary"
            />
            <UIcon
              v-if="member.participant.isCameraEnabled"
              name="i-lucide-video"
              class="size-4 text-primary"
            />
            <UIcon
              :name="member.participant.isMicrophoneEnabled ? 'i-lucide-mic' : 'i-lucide-mic-off'"
              :class="['size-4', member.participant.isMicrophoneEnabled && 'text-primary']"
            />
          </div>
        </li>
      </ul>
    </section>

    <section v-if="bots.length > 0">
      <USeparator class="mb-3" />
      <h3 class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        Bots
      </h3>
      <ul class="space-y-2.5">
        <li
          v-for="bot in bots"
          :key="bot.name"
          class="flex items-center justify-between gap-2"
        >
          <UUser
            :name="bot.name"
            :description="isTyping(bot.name) ? 'typing…' : bot.role"
            :avatar="{ ...avatar(bot.name, 'bot'), class: 'rounded-md' }"
            size="sm"
          />
          <USwitch
            :model-value="isBotEnabled(bot.name)"
            size="sm"
            :aria-label="`${isBotEnabled(bot.name) ? 'Disable' : 'Enable'} ${bot.name}`"
            @update:model-value="toggleBot(bot.name)"
          />
        </li>
      </ul>
      <p class="text-xs text-dimmed mt-3">
        Enabled bots answer when you mention them and sometimes chime in. Only your browser's setting.
      </p>
    </section>
  </div>
</template>
