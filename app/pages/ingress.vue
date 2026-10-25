<script setup lang="ts">
// No auth middleware - public view-only page
const { clientId } = useUser()

// Generate random viewer name to avoid conflicts. The VIEWER_IDENTITY_PREFIX
// keeps this in sync with isHiddenFromChat() so viewers don't pollute the chat
// user list or the bot participant count.
const viewerName = `${VIEWER_IDENTITY_PREFIX}${Math.random().toString(36).substring(2, 8)}`

// Connect to LiveKit room
const liveKitRoom = useLiveKitRoom({
  roomName: ROOM_NAME,
  participantName: viewerName,
  participantMetadata: {
    userId: clientId.value
  },
  autoConnect: true
})

// Find obs-stream participant
const obsParticipant = computed(() => {
  return liveKitRoom.remoteParticipants.value.find(p => p.identity === OBS_STREAM_IDENTITY)
})

// Get video track from obs-stream
const videoTrack = computed(() => {
  if (!obsParticipant.value) return undefined
  return liveKitRoom.getVideoTrack(OBS_STREAM_IDENTITY)
})

// Get audio track from obs-stream
const audioTrack = computed(() => {
  if (!obsParticipant.value) return undefined
  return liveKitRoom.getAudioTrack(OBS_STREAM_IDENTITY)
})

// Check if stream is available
const hasStream = computed(() => {
  return obsParticipant.value?.isCameraEnabled && !!videoTrack.value
})

// Audio starts muted so playback can autostart under browser autoplay policy;
// the user unmutes with a single click (a valid user gesture).
const isMuted = ref(true)
const toggleMute = () => {
  isMuted.value = !isMuted.value
}
</script>

<template>
  <div class="fixed inset-0 bg-black flex items-center justify-center">
    <template v-if="hasStream">
      <!-- Video Stream -->
      <VideoTrack
        :track="videoTrack"
        :participant-identity="OBS_STREAM_IDENTITY"
        class="w-full h-full"
        class-name="w-full h-full object-cover"
        :clickable="false"
      />

      <!-- Audio Stream (rendered as a hidden <audio> element by VideoTrack) -->
      <VideoTrack
        v-if="audioTrack"
        :track="audioTrack"
        :participant-identity="OBS_STREAM_IDENTITY"
        :muted="isMuted"
        :clickable="false"
      />

      <!-- Mute / unmute toggle -->
      <UButton
        v-if="audioTrack"
        :icon="isMuted ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
        :aria-label="isMuted ? 'Unmute' : 'Mute'"
        color="neutral"
        variant="solid"
        size="lg"
        class="absolute bottom-4 right-4 opacity-70 hover:opacity-100 transition-opacity"
        @click="toggleMute"
      />
    </template>

    <!-- Waiting Overlay -->
    <div
      v-else
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-center space-y-4">
        <UIcon
          name="i-lucide-video-off"
          class="text-neutral-600 h-24 w-24 mx-auto"
        />
        <h2 class="text-2xl font-medium text-white">
          Waiting for stream...
        </h2>
        <p class="text-neutral-400">
          The stream will appear here once OBS starts broadcasting
        </p>
      </div>
    </div>
  </div>
</template>
