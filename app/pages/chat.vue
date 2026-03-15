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

// Computed property for human user count (excluding bots) to match ChatUserList
const humanUserCount = computed(() => {
  const users = []

  // Add local participant
  if (liveKitRoom?.localParticipant.value) {
    users.push(liveKitRoom.localParticipant.value)
  }

  // Add remote participants
  if (liveKitRoom?.remoteParticipants.value) {
    users.push(...liveKitRoom.remoteParticipants.value)
  }

  // Filter out bots (same logic as ChatUserList)
  return users.filter(user => !user.identity?.startsWith('ai-')).length
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

const handleConnected = () => {
  isReady.value = true
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

// Handle media control events
const handleWebcamToggle = async () => {
  try {
    await liveKitRoom.enableCamera(!liveKitRoom.isCameraEnabled.value)
  } catch (error) {
    console.error('[Chat] Failed to toggle camera:', error)
  }
}

const handleMicToggle = async () => {
  try {
    await liveKitRoom.enableMicrophone(!liveKitRoom.isMicrophoneEnabled.value)
  } catch (error) {
    console.error('[Chat] Failed to toggle microphone:', error)
  }
}

const handleScreenToggle = async () => {
  try {
    await liveKitRoom.enableScreenShare(!liveKitRoom.isScreenShareEnabled.value)
  } catch (error) {
    console.error('[Chat] Failed to toggle screen share:', error)
  }
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
            <div class="flex items-center gap-2">
              <h3 class="font-semibold">
                Chat
              </h3>
              <UBadge
                :label="String(humanUserCount)"
                color="success"
                variant="subtle"
              />
            </div>
            <div class="flex items-center gap-3">
              <!-- Sound Settings Popover -->
              <UPopover>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-volume-2"
                />

                <template #content>
                  <div class="p-4 w-96">
                    <SoundSettings />
                  </div>
                </template>
              </UPopover>

              <!-- User List Popover -->
              <UPopover>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-users"
                />

                <template #content>
                  <div class="p-4 w-80  overflow-y-auto">
                    <ChatUserList />
                  </div>
                </template>
              </UPopover>

              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-log-out"

                @click="async () => { await liveKitRoom.disconnect(); navigateTo('/') }"
              />
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
              <div class="flex items-center gap-2">
                <UChip
                  :show="liveKitRoom.isConnected.value"
                  :color="liveKitRoom.isConnected.value && isDaemonConnected ? 'success' : liveKitRoom.isConnected.value ? 'warning' : 'error'"
                  size="2xs"
                  inset
                >
                  <div class="text-2xl font-semibold logo">
                    Ramble
                  </div>
                </UChip>
              </div>
            </template>
            <template #right>
              <div class="flex items-center gap-3">
                <!-- Streaming Controls -->
                <UButton
                  :color="liveKitRoom.isMicrophoneEnabled.value ? 'primary' : 'neutral'"
                  variant="ghost"
                  icon="i-lucide-mic"
                  @click="handleMicToggle"
                />
                <UButton
                  :color="liveKitRoom.isCameraEnabled.value ? 'primary' : 'neutral'"
                  variant="ghost"
                  icon="i-lucide-video"
                  @click="handleWebcamToggle"
                />
                <UButton
                  :color="liveKitRoom.isScreenShareEnabled.value ? 'primary' : 'neutral'"
                  variant="ghost"
                  icon="i-lucide-screen-share"
                  @click="handleScreenToggle"
                />

                <!-- Settings Button -->
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-settings"
                  @click="isSettingsOpen = true"
                />
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

    <div v-else class="flex items-center justify-center h-screen">
      <UCard>
        <p>Just a moment...</p>
      </UCard>
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
