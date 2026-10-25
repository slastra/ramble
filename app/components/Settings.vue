<script setup lang="ts">
import type { IngressInfo } from '#shared/types/ingress'
import type { MediaDeviceKind } from '../composables/useMediaControls'

const liveKitRoom = injectRoomContext(LiveKitRoomKey)
const { chooseDevice } = useMediaControls(liveKitRoom)

const cameras = liveKitRoom.cameras
const microphones = liveKitRoom.microphones
const speakers = liveKitRoom.speakers
const supportsSpeakerSelection = liveKitRoom.supportsSpeakerSelection

// The selects show what LiveKit is using; picking one switches and remembers it
function deviceModel(kind: MediaDeviceKind, selected: Ref<string | null>) {
  return computed({
    get: () => selected.value || '',
    set: (deviceId: string) => {
      if (deviceId) chooseDevice(kind, deviceId)
    }
  })
}
const selectedCamera = deviceModel('videoInput', liveKitRoom.selectedCamera)
const selectedMicrophone = deviceModel('audioInput', liveKitRoom.selectedMicrophone)
const selectedSpeaker = deviceModel('audioOutput', liveKitRoom.selectedSpeaker)

// WHIP Ingress management
const ingressInfo = ref<IngressInfo | null>(null)
const isLoadingIngress = ref(false)
const ingressError = ref<string | null>(null)
const showStreamKey = ref(false)
const toast = useToast()

const tabs = [
  { label: 'Devices', icon: 'i-lucide-headphones', value: 'devices', slot: 'devices' as const },
  { label: 'Sounds', icon: 'i-lucide-bell', value: 'sounds', slot: 'sounds' as const },
  { label: 'Notifications', icon: 'i-lucide-smartphone', value: 'notifications', slot: 'notifications' as const },
  { label: 'Streaming', icon: 'i-lucide-radio', value: 'streaming', slot: 'streaming' as const }
]
const activeTab = ref('devices')

// Asking for the stream details creates the room's ingress on first use, so only do
// it when someone opens the Streaming tab
async function loadIngress() {
  if (ingressInfo.value || isLoadingIngress.value) return
  isLoadingIngress.value = true
  ingressError.value = null

  try {
    const headers: Record<string, string> = {}
    if (liveKitRoom.livekitToken.value) headers.Authorization = `Bearer ${liveKitRoom.livekitToken.value}`

    const response = await $fetch('/api/whip-ingress', {
      method: 'POST',
      headers,
      body: { roomName: liveKitRoom.roomName }
    })
    ingressInfo.value = response.ingress
  } catch (error) {
    console.error('[Settings] Failed to create WHIP ingress:', error)
    ingressError.value = 'Failed to create ingress. Ensure LiveKit server has ingress service enabled.'
  } finally {
    isLoadingIngress.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'streaming') loadIngress()
})

onMounted(() => {
  // Device labels are blank until the browser grants access; refresh in case it has since
  liveKitRoom.refreshDevices()
})

// Copy to clipboard helper
const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({
      title: 'Copied',
      description: `${label} copied to clipboard`,
      icon: 'i-lucide-check',
      color: 'success'
    })
  } catch (error) {
    console.error('[Settings] Failed to copy to clipboard:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to copy to clipboard',
      icon: 'i-lucide-x',
      color: 'error'
    })
  }
}
</script>

<template>
  <UTabs
    :items="tabs"
    variant="link"
    size="sm"
    class="w-full"
    :ui="{ content: 'pt-5' }"
  >
    <template #devices>
      <div class="space-y-4">
        <UFormField v-if="cameras.length > 0" label="Camera">
          <USelect
            v-model="selectedCamera"
            :items="cameras.map(cam => ({ value: cam.deviceId, label: cam.label || `Camera ${cam.deviceId.slice(0, 8)}` }))"
            value-key="value"
            placeholder="Select camera"
            icon="i-lucide-video"
            class="w-full"
          />
        </UFormField>

        <UFormField v-if="microphones.length > 0" label="Microphone">
          <USelect
            v-model="selectedMicrophone"
            :items="microphones.map(mic => ({ value: mic.deviceId, label: mic.label || `Microphone ${mic.deviceId.slice(0, 8)}` }))"
            value-key="value"
            placeholder="Select microphone"
            icon="i-lucide-mic"
            class="w-full"
          />
        </UFormField>

        <UFormField v-if="speakers.length > 0 && supportsSpeakerSelection" label="Speaker">
          <USelect
            v-model="selectedSpeaker"
            :items="speakers.map(speaker => ({ value: speaker.deviceId, label: speaker.label || `Speaker ${speaker.deviceId.slice(0, 8)}` }))"
            value-key="value"
            placeholder="Select speaker"
            icon="i-lucide-volume-2"
            class="w-full"
          />
        </UFormField>

        <UEmpty
          v-if="cameras.length === 0 && microphones.length === 0"
          variant="naked"
          size="sm"
          icon="i-lucide-plug-zap"
          title="No devices yet"
          description="Turn on your camera or microphone once so the browser lists your devices."
        />

        <p class="text-xs text-dimmed">
          Your choices are remembered on this browser.
        </p>
      </div>
    </template>

    <template #sounds>
      <SoundSettings />
    </template>

    <template #notifications>
      <NotificationSettings />
    </template>

    <template #streaming>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Anyone in the room can stream from OBS Studio. The stream shows up in the video grid and on <ULink to="/ingress" class="text-primary">/ingress</ULink>.
        </p>

        <div v-if="isLoadingIngress" class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="animate-spin" />
          Getting your stream details…
        </div>

        <UAlert
          v-else-if="ingressError"
          color="error"
          variant="subtle"
          :title="ingressError"
          icon="i-lucide-circle-alert"
        />

        <template v-else-if="ingressInfo">
          <UFormField label="Server">
            <UInput
              :model-value="ingressInfo.url"
              readonly
              class="w-full"
              :ui="{ base: 'font-mono text-xs', trailing: 'pe-1' }"
            >
              <template #trailing>
                <UTooltip text="Copy">
                  <UButton
                    icon="i-lucide-copy"
                    color="neutral"
                    variant="link"
                    size="sm"
                    aria-label="Copy server URL"
                    @click="copyToClipboard(ingressInfo.url, 'Server URL')"
                  />
                </UTooltip>
              </template>
            </UInput>
          </UFormField>

          <UFormField label="Bearer token (stream key)">
            <UInput
              :model-value="ingressInfo.streamKey"
              :type="showStreamKey ? 'text' : 'password'"
              readonly
              class="w-full"
              :ui="{ base: 'font-mono text-xs', trailing: 'pe-1' }"
            >
              <template #trailing>
                <UTooltip :text="showStreamKey ? 'Hide' : 'Show'">
                  <UButton
                    :icon="showStreamKey ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    color="neutral"
                    variant="link"
                    size="sm"
                    :aria-label="showStreamKey ? 'Hide stream key' : 'Show stream key'"
                    @click="showStreamKey = !showStreamKey"
                  />
                </UTooltip>
                <UTooltip text="Copy">
                  <UButton
                    icon="i-lucide-copy"
                    color="neutral"
                    variant="link"
                    size="sm"
                    aria-label="Copy stream key"
                    @click="copyToClipboard(ingressInfo.streamKey, 'Stream key')"
                  />
                </UTooltip>
              </template>
            </UInput>
          </UFormField>

          <ol class="text-sm text-muted space-y-1.5 list-decimal list-inside marker:text-dimmed">
            <li>In OBS (30 or newer), open <strong class="text-default">Settings → Stream</strong></li>
            <li>Set <strong class="text-default">Service</strong> to <strong class="text-default">WHIP</strong></li>
            <li>Paste the server and the bearer token above, then start streaming</li>
          </ol>
        </template>
      </div>
    </template>
  </UTabs>
</template>
