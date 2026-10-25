<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const liveKitRoom = injectRoomContext(LiveKitRoomKey)
const { toggleMicrophone, toggleCamera, toggleScreenShare, chooseDevice } = useMediaControls(liveKitRoom)

// Same keys as Google Meet; usingInput so they work while typing a message
defineShortcuts({
  meta_d: { usingInput: true, handler: toggleMicrophone },
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

const audioMenu = computed((): DropdownMenuItem[][] => {
  const groups: DropdownMenuItem[][] = [[
    { label: 'Microphone', type: 'label' },
    ...deviceItems(liveKitRoom.microphones.value, liveKitRoom.selectedMicrophone.value, 'Microphone', id => chooseDevice('audioInput', id))
  ]]
  if (liveKitRoom.supportsSpeakerSelection.value && liveKitRoom.speakers.value.length > 0) {
    groups.push([
      { label: 'Speaker', type: 'label' },
      ...deviceItems(liveKitRoom.speakers.value, liveKitRoom.selectedSpeaker.value, 'Speaker', id => chooseDevice('audioOutput', id))
    ])
  }
  return groups
})

const videoMenu = computed((): DropdownMenuItem[][] => [[
  { label: 'Camera', type: 'label' },
  ...deviceItems(liveKitRoom.cameras.value, liveKitRoom.selectedCamera.value, 'Camera', id => chooseDevice('videoInput', id))
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
          @click="toggleMicrophone"
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
        @click="toggleScreenShare"
      />
    </UTooltip>
  </div>
</template>
