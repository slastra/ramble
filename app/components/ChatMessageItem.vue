<script setup lang="ts">
import type { ChatMessage } from '../../shared/types/chat'

const props = defineProps<{
  message: ChatMessage
  // First message of a run from the same sender: shows the avatar, name and time
  groupStart: boolean
}>()

const { clientId } = useUser()

const isOwnMessage = computed(() => props.message.userId === clientId.value)
const isSystemMessage = computed(() => props.message.type === 'system')
const isAIMessage = computed(() => props.message.type === 'bot')

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const time = computed(() => timeFormat.format(props.message.timestamp))
const exactTime = computed(() => fullFormat.format(props.message.timestamp))

const parsedMessage = computed(() => {
  const { text, attachments } = parseMessageContent(props.message.content)
  return { content: text, attachments }
})

// UChatMessage expects AI SDK message parts; the content slot below does the rendering
const parts = computed(() => [{ type: 'text' as const, text: parsedMessage.value.content }])

// DiceBear avatar: initial face for people, robot face for bots
const avatarUrl = useDiceBearAvatar(props.message.userName, isAIMessage.value ? 'bot' : 'user')

const prose = [
  // Nuxt UI's prose paragraphs are article-sized (leading-7, my-5); chat wants them tight
  'text-sm text-default leading-normal',
  '[&_p]:my-1 [&_p]:text-sm [&_p]:leading-normal [&_strong]:text-highlighted [&_em]:text-toned',
  '[&_li]:my-0 [&_li]:text-sm [&_li]:leading-normal',
  '[&_a]:text-primary [&_a]:underline [&_a]:decoration-dotted [&_a:hover]:decoration-solid',
  '[&_code]:font-mono [&_code]:text-[0.8125rem] [&_code]:bg-accented/60 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5',
  '[&_pre]:bg-accented/60 [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-accented [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_blockquote]:my-2',
  '[&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold'
]
</script>

<template>
  <!-- Joins and leaves -->
  <div v-if="isSystemMessage" class="flex justify-center py-2">
    <UTooltip :text="exactTime">
      <span class="text-xs text-dimmed">{{ message.content }} · {{ time }}</span>
    </UTooltip>
  </div>

  <UChatMessage
    v-else
    :id="message.id"
    :role="isOwnMessage ? 'user' : 'assistant'"
    :parts="parts"
    :side="isOwnMessage ? 'right' : 'left'"
    :variant="isAIMessage ? 'subtle' : 'soft'"
    :color="isOwnMessage ? 'primary' : 'neutral'"
    compact
    :ui="{
      root: groupStart ? 'pt-2' : '',
      container: ['gap-2 pb-1', isOwnMessage ? 'max-w-[85%]' : 'max-w-[92%]'],
      leading: 'mt-0 self-start',
      header: 'mb-0.5 px-1',
      content: [
        'px-3 py-2 min-h-0 rounded-xl',
        isOwnMessage ? 'bg-primary/12 rounded-br-sm' : 'rounded-bl-sm',
        ...prose
      ]
    }"
  >
    <template v-if="isOwnMessage && groupStart" #header>
      <UTooltip :text="exactTime">
        <span class="text-xs text-dimmed tabular-nums">{{ time }}</span>
      </UTooltip>
    </template>

    <template v-if="!isOwnMessage" #leading>
      <UAvatar
        v-if="groupStart"
        :src="avatarUrl"
        :alt="message.userName"
        size="md"
        :class="isAIMessage ? 'rounded-lg' : ''"
      />
      <span v-else class="w-8 shrink-0" />
    </template>

    <template #content>
      <div v-if="!isOwnMessage && groupStart" class="flex items-center gap-1.5 mb-0.5">
        <span class="text-xs font-semibold text-highlighted">{{ message.userName }}</span>
        <UBadge
          v-if="isAIMessage"
          label="bot"
          size="sm"
          color="neutral"
          variant="subtle"
          class="px-1 py-0 text-[0.625rem] uppercase tracking-wide"
        />
        <UTooltip :text="exactTime">
          <span class="text-xs text-dimmed tabular-nums">{{ time }}</span>
        </UTooltip>
      </div>

      <MDC v-if="parsedMessage.content.trim()" :value="parsedMessage.content" />

      <AttachmentRenderer
        v-if="parsedMessage.attachments.length > 0"
        :attachments="parsedMessage.attachments"
      />
    </template>
  </UChatMessage>
</template>
