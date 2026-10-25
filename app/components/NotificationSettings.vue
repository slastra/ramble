<script setup lang="ts">
const liveKitRoom = injectRoomContext(LiveKitRoomKey)
const { support, permission, subscribed, events, busy, refresh, enable, disable, setEvents, sendTest } = usePushNotifications(liveKitRoom.livekitToken)
const toast = useToast()

// iPhones and iPads only allow web notifications for sites added to the Home Screen
const needsHomeScreen = ref(false)
onMounted(async () => {
  await refresh().catch(() => {})
  needsHomeScreen.value = /iPhone|iPad|iPod/.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches
})

const notificationsOn = computed({
  get: () => subscribed.value,
  set: (on: boolean) => {
    const change = on ? enable() : disable()
    change.catch((error) => {
      console.error('[Notifications] Failed to change:', error)
      toast.add({ title: 'Couldn\'t change notifications', description: 'Please try again.', icon: 'i-lucide-bell-off', color: 'error' })
    })
  }
})

function eventModel(kind: 'messages' | 'joins') {
  return computed({
    get: () => events.value[kind],
    set: (on: boolean) => {
      setEvents({ ...events.value, [kind]: on }).catch(() => {})
    }
  })
}
const messagesOn = eventModel('messages')
const joinsOn = eventModel('joins')

const testing = ref(false)
async function test() {
  testing.value = true
  try {
    await sendTest()
    toast.add({ title: 'Test sent', description: 'Switch to another window or tab to see it.', icon: 'i-lucide-send', color: 'success' })
  } catch {
    toast.add({ title: 'Couldn\'t send a test', description: 'Turn notifications off and on again, then retry.', icon: 'i-lucide-bell-off', color: 'error' })
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <UAlert
      v-if="support === 'unsupported'"
      icon="i-lucide-bell-off"
      color="neutral"
      variant="subtle"
      :title="needsHomeScreen ? 'Add Ramble to your Home Screen first' : 'This browser can\'t show notifications'"
      :description="needsHomeScreen
        ? 'On iPhone and iPad, tap Share, then Add to Home Screen. Open Ramble from there and turn notifications on.'
        : 'Try a current version of Chrome, Firefox, Edge or Safari.'"
    />

    <UAlert
      v-else-if="support === 'unconfigured'"
      icon="i-lucide-bell-off"
      color="neutral"
      variant="subtle"
      title="Notifications aren't set up on this server"
    />

    <template v-else>
      <UAlert
        v-if="permission === 'denied'"
        icon="i-lucide-bell-off"
        color="warning"
        variant="subtle"
        title="Notifications are blocked for this site"
        description="Allow them in your browser's site settings, then come back and turn them on."
      />

      <USwitch
        v-model="notificationsOn"
        :loading="busy"
        :disabled="permission === 'denied'"
        label="Notifications on this device"
        description="Hear from the room while you're away, even with Ramble closed. While you're in the room, they only show when its tab is in the background."
      />

      <template v-if="subscribed">
        <div class="space-y-3 border-s-2 border-default ps-4">
          <USwitch v-model="messagesOn" label="New messages" size="sm" />
          <USwitch v-model="joinsOn" label="When someone joins" size="sm" />
        </div>

        <UButton
          label="Send a test"
          icon="i-lucide-send"
          color="neutral"
          variant="subtle"
          size="sm"
          :loading="testing"
          @click="test"
        />
      </template>

      <p class="text-xs text-dimmed">
        Your browser's push service delivers them encrypted. Ramble keeps this device's push address and your name until you turn notifications off.
      </p>
    </template>
  </div>
</template>
