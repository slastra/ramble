<script setup lang="ts">
const liveKitChat = injectRoomContext(LiveKitChatKey)
const liveKitRoom = injectRoomContext(LiveKitRoomKey)
const { clientId } = useUser()

// A run of messages from one sender within this window shares one avatar and header
const GROUP_WINDOW_MS = 5 * 60 * 1000
// How close to the bottom still counts as "at the bottom" for auto-scroll
const BOTTOM_THRESHOLD_PX = 80

// Hide bot messages that are still empty while a reply streams in
const visibleMessages = computed(() =>
  liveKitChat.messages.value.filter(m => m.type !== 'bot' || m.content.trim().length > 0)
)

const rows = computed(() => visibleMessages.value.map((message, i) => {
  const previous = visibleMessages.value[i - 1]
  const groupStart = !previous
    || previous.type === 'system'
    || previous.userId !== message.userId
    || message.timestamp - previous.timestamp > GROUP_WINDOW_MS
  return { message, groupStart }
}))

const isConnecting = computed(() => !liveKitRoom.isConnected.value && liveKitRoom.isConnecting.value)

const { bots } = useBots()
const emptyHint = computed(() => {
  const names = bots.value.map(bot => bot.name)
  if (names.length === 0) return 'Say hi.'
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`
  return `Say hi, or mention ${list} to wake a bot up.`
})

// Follow new messages only while the reader is at the bottom; otherwise count them
// on the jump button instead of yanking the view away from what they're reading
const viewport = ref<HTMLElement>()
const content = ref<HTMLElement>()
const isAtBottom = ref(true)
const unreadCount = ref(0)

function measure() {
  const el = viewport.value
  if (!el) return
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX
  if (isAtBottom.value) unreadCount.value = 0
}

function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
  const el = viewport.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior })
  unreadCount.value = 0
}

watch(() => visibleMessages.value.length, async (count, previousCount = 0) => {
  const added = visibleMessages.value.slice(previousCount)
  const sentByMe = added.some(m => m.userId === clientId.value)
  await nextTick()
  if (isAtBottom.value || sentByMe) {
    scrollToBottom()
  } else {
    unreadCount.value += added.filter(m => m.type !== 'system').length
  }
})

// Images and late-rendering markdown change the height after a message arrives
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  scrollToBottom('instant')
  resizeObserver = new ResizeObserver(() => {
    if (isAtBottom.value) scrollToBottom('instant')
  })
  if (content.value) resizeObserver.observe(content.value)
})
onUnmounted(() => resizeObserver?.disconnect())
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 relative">
    <div
      ref="viewport"
      class="flex-1 flex flex-col overflow-y-auto px-3 py-4"
      @scroll.passive="measure"
    >
      <UEmpty
        v-if="visibleMessages.length === 0"
        variant="naked"
        :loading="isConnecting"
        :icon="isConnecting ? undefined : 'i-lucide-message-circle-dashed'"
        :title="isConnecting ? 'Connecting…' : 'Nothin\' yet!'"
        :description="isConnecting ? undefined : emptyHint"
        class="flex-1"
      />

      <div ref="content" :class="visibleMessages.length === 0 ? 'hidden' : 'mt-auto'">
        <ChatMessageItem
          v-for="row in rows"
          :key="row.message.id"
          :message="row.message"
          :group-start="row.groupStart"
          class="message-in"
        />

        <ChatTypingIndicator :names="liveKitChat.typingUsers.value" />
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 translate-y-2"
    >
      <UButton
        v-if="!isAtBottom && visibleMessages.length > 0"
        :label="unreadCount > 0 ? `${unreadCount} new` : undefined"
        :aria-label="unreadCount > 0 ? `${unreadCount} new messages, jump to latest` : 'Jump to latest'"
        icon="i-lucide-arrow-down"
        color="neutral"
        variant="outline"
        size="sm"
        class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-lg bg-default"
        @click="scrollToBottom()"
      />
    </Transition>
  </div>
</template>

<style scoped>
/* New messages rise in; existing ones don't animate on first render of the list */
.message-in {
  animation: message-in 220ms ease-out both;
}

@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .message-in {
    animation: none;
  }
}
</style>
