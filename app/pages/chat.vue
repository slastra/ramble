<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const { clientId, userName } = useUser()

const isReady = ref(false)
const isSettingsOpen = ref(false)

// Initialize LiveKit room
const liveKitRoom = useLiveKitRoom({
  roomName: 'main-chat-room',
  participantName: userName.value || 'Anonymous',
  participantMetadata: {
    userId: clientId.value
  },
  autoConnect: true,
  adaptiveStream: true
})

// Initialize LiveKit chat
const liveKitChat = useLiveKitChat({
  room: liveKitRoom.room,
  userId: clientId.value,
  userName: userName.value || 'Anonymous',
  token: liveKitRoom.livekitToken
})

// Initialize LiveKit bot integration
const liveKitBots = useLiveKitBots({
  liveKitChat,
  liveKitRoom,
  userId: clientId.value,
  userName: userName.value || 'Anonymous'
})

// Computed property to get all participants for audio rendering
const allParticipants = computed(() => {
  const participants = [...liveKitRoom.remoteParticipants.value]
  if (liveKitRoom.localParticipant.value) {
    participants.push(liveKitRoom.localParticipant.value)
  }
  return participants
})

// People in the room as the chat shows them (no bots, stream, or viewers)
const { members } = useRoomMembers(liveKitRoom)
const memberAvatars = computed(() => members.value.map(member => ({
  src: useDiceBearAvatar(member.name).value,
  alt: member.name
})))

const { enabled: soundsEnabled } = useSoundSettings()

const connectionLabel = computed(() => {
  if (!liveKitRoom.isConnected.value) return liveKitRoom.isConnecting.value ? 'Reconnecting…' : 'Disconnected'
  return isDaemonConnected.value ? 'Connected · desktop notifications on' : 'Connected'
})

// Track if chat sidebar is open
const isChatVisible = ref(true)

// Detect viewport size (large breakpoint is 1024px in Tailwind)
const isLargeViewport = useMediaQuery('(min-width: 1024px)')

// Computed: chat is visible if large viewport OR manually opened on small screens
const chatActuallyVisible = computed(() => isLargeViewport.value || isChatVisible.value)

// Initialize daemon sync with chat visibility tracking
const { isDaemonConnected } = useDaemonSync(chatActuallyVisible)

// Provide instances to child components
provide('liveKitRoom', liveKitRoom)
provide('liveKitChat', liveKitChat)
provide('liveKitBots', liveKitBots)

// Named handlers for event listener cleanup
const handleParticipantConnected = (participant: unknown) => {
  const p = participant as { name?: string, identity: string }
  const name = p.name || p.identity
  liveKitChat.addLocalSystemMessage(`${name} joined the chat`)
  const { playSound } = useSoundManager()
  playSound('userJoined')
}

const handleParticipantDisconnected = (participant: unknown) => {
  const p = participant as { name?: string, identity: string }
  const name = p.name || p.identity
  liveKitChat.addLocalSystemMessage(`${name} left the chat`)
  const { playSound } = useSoundManager()
  playSound('userLeft')
}

const devicePrefs = useDevicePreferences()

const handleConnected = () => {
  isReady.value = true
  if (devicePrefs.microphone.value) handleDeviceChange('audioInput', devicePrefs.microphone.value)
  if (devicePrefs.camera.value) handleDeviceChange('videoInput', devicePrefs.camera.value)
  if (devicePrefs.speaker.value && liveKitRoom.supportsSpeakerSelection.value) {
    handleDeviceChange('audioOutput', devicePrefs.speaker.value)
  }
}

const handleDisconnected = () => {
  isReady.value = false
}

onMounted(() => {
  liveKitRoom.on('participantConnected', handleParticipantConnected)
  liveKitRoom.on('participantDisconnected', handleParticipantDisconnected)
  liveKitRoom.on('connected', handleConnected)
  liveKitRoom.on('disconnected', handleDisconnected)
})

onUnmounted(async () => {
  liveKitRoom.off('participantConnected', handleParticipantConnected)
  liveKitRoom.off('participantDisconnected', handleParticipantDisconnected)
  liveKitRoom.off('connected', handleConnected)
  liveKitRoom.off('disconnected', handleDisconnected)
  await liveKitRoom.disconnect()
})

async function leave() {
  await liveKitRoom.disconnect()
  await navigateTo('/')
}

const handleDeviceChange = async (type: 'videoInput' | 'audioInput' | 'audioOutput', deviceId: string) => {
  try {
    switch (type) {
      case 'audioInput':
        await liveKitRoom.switchMicrophone(deviceId)
        break
      case 'videoInput':
        await liveKitRoom.switchCamera(deviceId)
        break
      case 'audioOutput':
        await liveKitRoom.switchSpeaker(deviceId)
        break
    }
  } catch (error) {
    console.error(`[Chat] Failed to change ${type} device:`, error)
  }
}
</script>

<template>
  <div>
    <UDashboardGroup v-if="isReady">
      <UDashboardSidebar
        v-model:open="isChatVisible"
        resizable
        :min-size="25"
        :default-size="30"
        :max-size="50"
        :ui="{ body: 'flex flex-col' }"
        class="bg-elevated/50"
      >
        <template #header>
          <div class="flex items-center justify-between w-full gap-2">
            <div class="flex items-center gap-3 min-w-0">
              <h2 class="font-semibold text-highlighted">
                Chat
              </h2>

              <!-- Who's here; opens the member and bot list -->
              <UPopover :content="{ align: 'start' }">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  class="px-1.5 gap-2"
                  :aria-label="`${members.length} in the room, show people and bots`"
                >
                  <UAvatarGroup size="2xs" :max="4">
                    <UAvatar
                      v-for="avatar in memberAvatars"
                      :key="avatar.alt"
                      :src="avatar.src"
                      :alt="avatar.alt"
                    />
                  </UAvatarGroup>
                  <span class="text-xs text-muted tabular-nums">{{ members.length }}</span>
                </UButton>

                <template #content>
                  <div class="p-3 w-72 max-h-[70vh] overflow-y-auto">
                    <ChatUserList />
                  </div>
                </template>
              </UPopover>
            </div>

            <div class="flex items-center gap-1">
              <UTooltip :text="soundsEnabled ? 'Mute sounds' : 'Unmute sounds'">
                <UButton
                  color="neutral"
                  variant="ghost"
                  :icon="soundsEnabled ? 'i-lucide-bell' : 'i-lucide-bell-off'"
                  :aria-pressed="!soundsEnabled"
                  aria-label="Sounds"
                  @click="soundsEnabled = !soundsEnabled"
                />
              </UTooltip>
              <UTooltip text="Leave the room">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-log-out"
                  aria-label="Leave the room"
                  @click="leave"
                />
              </UTooltip>
            </div>
          </div>
        </template>

        <ChatMessageList />

        <template #footer>
          <ChatInput />
        </template>
      </UDashboardSidebar>

      <UDashboardPanel id="video-grid" class="relative" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <UDashboardNavbar>
            <template #left>
              <UTooltip :text="connectionLabel">
                <UChip
                  :color="liveKitRoom.isConnected.value ? 'success' : liveKitRoom.isConnecting.value ? 'warning' : 'error'"
                  size="sm"
                  position="top-right"
                  inset
                >
                  <span class="text-2xl font-semibold logo">Ramble</span>
                </UChip>
              </UTooltip>
            </template>
            <template #right>
              <div class="flex items-center gap-2">
                <MediaControls />
                <UTooltip text="Settings">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-settings"
                    aria-label="Settings"
                    @click="isSettingsOpen = true"
                  />
                </UTooltip>
              </div>
            </template>
          </UDashboardNavbar>
        </template>

        <template #body>
          <VideoGridPanel />
        </template>
      </UDashboardPanel>

      <!-- Audio Enable Prompt -->
    </UDashboardGroup>

    <!-- Audio Rendering (hidden, for audio playback only) -->
    <div v-if="isReady" class="hidden">
      <!-- Render microphone audio for all participants (exclude local to prevent feedback) -->
      <div v-for="participant in allParticipants" :key="`mic-audio-${participant.identity}`">
        <VideoTrack
          v-if="participant.isMicrophoneEnabled && participant.identity !== liveKitRoom.localParticipant.value?.identity"
          :track="liveKitRoom.getAudioTrack(participant.identity)"
          :participant-identity="participant.identity"
          :is-local="false"
          :muted="false"
          :autoplay="true"
        />
      </div>

      <!-- Render screen share audio for remote participants only (exclude local to prevent feedback) -->
      <div v-for="participant in allParticipants" :key="`screen-audio-${participant.identity}`">
        <VideoTrack
          v-if="participant.tracks?.screenShareAudio && participant.identity !== liveKitRoom.localParticipant.value?.identity"
          :track="liveKitRoom.getScreenShareAudioTrack(participant.identity)"
          :participant-identity="participant.identity"
          :is-local="false"
          :muted="false"
          :autoplay="true"
        />
      </div>
    </div>

    <div v-else class="flex items-center justify-center h-dvh">
      <UEmpty
        variant="naked"
        loading
        title="Joining the room…"
      />
    </div>

    <!-- Settings Modal -->
    <UModal v-model:open="isSettingsOpen" title="Settings">
      <template #body>
        <Settings
          :supports-speaker-selection="liveKitRoom.supportsSpeakerSelection.value"
          :selected-camera="liveKitRoom.selectedCamera.value ?? undefined"
          :selected-microphone="liveKitRoom.selectedMicrophone.value ?? undefined"
          :selected-speaker="liveKitRoom.selectedSpeaker.value ?? undefined"
          @device-change="handleDeviceChange"
        />
      </template>
    </UModal>
  </div>
</template>
