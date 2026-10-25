<script setup lang="ts">
const props = defineProps<{
  // Names of everyone typing right now, people and bots
  names: string[]
}>()

const { bots } = useBots()
const botNames = computed(() => new Set(bots.value.map(bot => bot.name)))

// The first typist fronts the indicator, lined up with the avatar column of the messages
const lead = computed(() => {
  const name = props.names[0]
  if (!name) return null
  const isBot = botNames.value.has(name)
  return { name, isBot, avatar: useDiceBearAvatar(name, isBot ? 'bot' : 'user').value }
})

const label = computed(() => {
  const [first, second, ...rest] = props.names
  if (!first) return ''
  if (!second) return `${first} is typing`
  if (rest.length === 0) return `${first} and ${second} are typing`
  return `${first}, ${second} and ${rest.length} ${rest.length === 1 ? 'other' : 'others'} are typing`
})
</script>

<template>
  <!-- Reserves its height so messages don't hop every time someone starts or stops typing -->
  <div class="h-10 pt-1.5">
    <span class="sr-only" aria-live="polite" aria-atomic="true">{{ label }}</span>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div v-if="lead" class="flex items-center gap-2" aria-hidden="true">
        <UAvatar
          :src="lead.avatar"
          :alt="lead.name"
          size="md"
          :class="['shrink-0', lead.isBot && 'rounded-lg']"
        />
        <div
          :class="[
            'flex items-center gap-1 px-3 h-8 rounded-xl rounded-bl-sm bg-elevated/50 text-muted',
            lead.isBot && 'ring ring-default'
          ]"
        >
          <span v-for="i in 3" :key="i" class="typing-dot" />
        </div>
        <UChatShimmer :text="label" class="text-xs truncate" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.typing-dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: currentColor;
  animation: typing-bounce 1.2s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  30% {
    transform: translateY(-3px);
    opacity: 0.9;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing-dot {
    animation: none;
    opacity: 0.6;
  }
}
</style>
