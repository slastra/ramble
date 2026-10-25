<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { UseLiveKitRoomReturn } from '../composables/useLiveKitRoom'

const liveKitRoom = inject('liveKitRoom') as UseLiveKitRoomReturn
const devicePrefs = useDevicePreferences()
const toast = useToast()

// Permission prompts and missing devices are the usual failures; say so instead of
// leaving a button that silently didn't turn on
async function attempt(action: () => Promise<void>, what: string) {
  try {
    await action()
  } catch (error) {
    toast.add({
      title: `Couldn't ${what}`,
      description: error instanceof Error ? error.message : undefined,
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
  }
}

const toggleMic = () => attempt(() => liveKitRoom.enableMicrophone(!liveKitRoom.isMicrophoneEnabled.value), 'switch the microphone')
const toggleCamera = () => attempt(() => liveKitRoom.enableCamera(!liveKitRoom.isCameraEnabled.value), 'switch the camera')
const toggleScreen = () => attempt(() => liveKitRoom.enableScreenShare(!liveKitRoom.isScreenShareEnabled.value), 'share your screen')

// Same keys as Google Meet; usingInput so they work while typing a message
defineShortcuts({
  meta_d: { usingInput: true, handler: toggleMic },
  meta_e: { usingInput: true, handler: toggleCamera }
})

function deviceItems(
  devices: MediaDeviceInfo[],
  selected: string | null,
  fallback: string,
  choose: (deviceId: string) => void
): DropdownMenuItem[] {
  return devices.map((device, i) => ({
    label: device.label || `${fallback} ${i + 1}`,
    type: 'checkbox' as const,
    checked: device.deviceId === selected,
    onUpdateChecked: () => choose(device.deviceId)
  }))
}

const chooseMicrophone = (deviceId: string) => attempt(async () => {
  await liveKitRoom.switchMicrophone(deviceId)
  devicePrefs.microphone.value = deviceId
}, 'switch microphones')

const chooseSpeaker = (deviceId: string) => attempt(async () => {
  await liveKitRoom.switchSpeaker(deviceId)
  devicePrefs.speaker.value = deviceId
}, 'switch speakers')

const chooseCamera = (deviceId: string) => attempt(async () => {
  await liveKitRoom.switchCamera(deviceId)
  devicePrefs.camera.value = deviceId
}, 'switch cameras')

const audioMenu = computed((): DropdownMenuItem[][] => {
  const groups: DropdownMenuItem[][] = [[
    { label: 'Microphone', type: 'label' },
    ...deviceItems(liveKitRoom.microphones.value, liveKitRoom.selectedMicrophone.value, 'Microphone', chooseMicrophone)
  ]]
  if (liveKitRoom.supportsSpeakerSelection.value && liveKitRoom.speakers.value.length > 0) {
    groups.push([
      { label: 'Speaker', type: 'label' },
      ...deviceItems(liveKitRoom.speakers.value, liveKitRoom.selectedSpeaker.value, 'Speaker', chooseSpeaker)
    ])
  }
  return groups
})

const videoMenu = computed((): DropdownMenuItem[][] => [[
  { label: 'Camera', type: 'label' },
  ...deviceItems(liveKitRoom.cameras.value, liveKitRoom.selectedCamera.value, 'Camera', chooseCamera)
]])

// Device labels are blank until the browser grants access, so refresh on open
function refreshOnOpen(open: boolean) {
  if (open) liveKitRoom.refreshDevices()
}

const micOn = computed(() => liveKitRoom.isMicrophoneEnabled.value)
const cameraOn = computed(() => liveKitRoom.isCameraEnabled.value)
const screenOn = computed(() => liveKitRoom.isScreenShareEnabled.value)
</script>

<template>
  <div class="flex items-center gap-2">
    <UFieldGroup>
      <UTooltip :text="micOn ? 'Mute microphone' : 'Unmute microphone'" :kbds="['meta', 'd']">
        <UButton
          :icon="micOn ? 'i-lucide-mic' : 'i-lucide-mic-off'"
          :color="micOn ? 'primary' : 'neutral'"
          :variant="micOn ? 'soft' : 'subtle'"
          :aria-pressed="micOn"
          aria-label="Microphone"
          @click="toggleMic"
        />
      </UTooltip>
      <UDropdownMenu :items="audioMenu" :content="{ align: 'end' }" @update:open="refreshOnOpen">
        <UButton
          icon="i-lucide-chevron-down"
          :color="micOn ? 'primary' : 'neutral'"
          :variant="micOn ? 'soft' : 'subtle'"
          aria-label="Audio devices"
          class="px-1"
        />
      </UDropdownMenu>
    </UFieldGroup>

    <UFieldGroup>
      <UTooltip :text="cameraOn ? 'Turn off camera' : 'Turn on camera'" :kbds="['meta', 'e']">
        <UButton
          :icon="cameraOn ? 'i-lucide-video' : 'i-lucide-video-off'"
          :color="cameraOn ? 'primary' : 'neutral'"
          :variant="cameraOn ? 'soft' : 'subtle'"
          :aria-pressed="cameraOn"
          aria-label="Camera"
          @click="toggleCamera"
        />
      </UTooltip>
      <UDropdownMenu :items="videoMenu" :content="{ align: 'end' }" @update:open="refreshOnOpen">
        <UButton
          icon="i-lucide-chevron-down"
          :color="cameraOn ? 'primary' : 'neutral'"
          :variant="cameraOn ? 'soft' : 'subtle'"
          aria-label="Cameras"
          class="px-1"
        />
      </UDropdownMenu>
    </UFieldGroup>

    <UTooltip :text="screenOn ? 'Stop sharing' : 'Share your screen'">
      <UButton
        :icon="screenOn ? 'i-lucide-screen-share-off' : 'i-lucide-screen-share'"
        :color="screenOn ? 'primary' : 'neutral'"
        :variant="screenOn ? 'soft' : 'subtle'"
        :aria-pressed="screenOn"
        aria-label="Screen share"
        @click="toggleScreen"
      />
    </UTooltip>
  </div>
</template>
