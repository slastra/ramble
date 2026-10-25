<script setup lang="ts">
import type { LiveKitParticipant } from '../composables/useLiveKitRoom'
import type { TilingItem } from '../utils/tiling'

const liveKitRoom = injectRoomContext(LiveKitRoomKey)
const { members } = useRoomMembers(liveKitRoom)
const { setCamera, setScreenShare } = useMediaControls(liveKitRoom)

interface VideoTileItem extends TilingItem {
  identity: string
  name: string
  kind: 'camera' | 'screen'
  isLocal: boolean
}

const participants = computed((): LiveKitParticipant[] => {
  const local = liveKitRoom.localParticipant.value
  const remotes = liveKitRoom.remoteParticipants.value.filter(p => !p.identity.startsWith(BOT_IDENTITY_PREFIX))
  return local ? [local, ...remotes] : remotes
})

// A tile for everyone with their camera or mic on (their avatar while the camera's off),
// plus one per screen share, which takes the main slot when it starts
const tiles = computed((): VideoTileItem[] => participants.value.flatMap((p) => {
  const name = p.name || p.identity
  const isLocal = p.identity === liveKitRoom.localParticipant.value?.identity
  const items: VideoTileItem[] = []
  if (p.isCameraEnabled || p.isMicrophoneEnabled) {
    items.push({ id: `${p.identity}:camera`, label: isLocal ? 'Your camera' : `${name}'s camera`, identity: p.identity, name, kind: 'camera', isLocal })
  }
  if (p.isScreenShareEnabled) {
    items.push({ id: `${p.identity}:screen`, label: `${name}'s screen`, identity: p.identity, name, kind: 'screen', isLocal, main: true })
  }
  return items
}))

const participantById = computed(() => new Map(participants.value.map(p => [p.identity, p])))
const identities = computed(() => [...new Set(tiles.value.map(tile => tile.identity))])
const { level, isSpeaking } = useSpeakingLevels(liveKitRoom, identities)

const trackFor = (tile: VideoTileItem) =>
  liveKitRoom.getVideoTrack(tile.identity, tile.kind === 'screen' ? 'screen_share' : 'camera')

// Full screen view; LiveKit's adaptive stream fetches the high-res layer for the bigger element
const fullscreen = ref<VideoTileItem | null>(null)
const isFullscreenOpen = computed({
  get: () => fullscreen.value !== null,
  set: (open: boolean) => {
    if (!open) fullscreen.value = null
  }
})
function openTile(id: string) {
  fullscreen.value = tiles.value.find(tile => tile.id === id) ?? null
}

const emptyTitle = computed(() => members.value.length <= 1 ? 'It\'s just you so far' : 'Nobody\'s on camera')
const emptyDescription = computed(() => {
  const others = members.value.filter(member => !member.isLocal).map(member => member.name)
  if (others.length === 0) return 'Turn on your camera or share your screen, and anyone who joins will see it here.'
  const names = others.length <= 2 ? others.join(' and ') : `${others.slice(0, 2).join(', ')} and ${others.length - 2} more`
  return `${names} ${others.length === 1 ? 'is' : 'are'} here. Go live to start the conversation.`
})

const emptyActions = computed(() => [
  { label: 'Turn on camera', icon: 'i-lucide-video', onClick: () => setCamera(true) },
  { label: 'Share screen', icon: 'i-lucide-screen-share', color: 'neutral' as const, variant: 'subtle' as const, onClick: () => setScreenShare(true) }
])
</script>

<template>
  <div class="relative flex-1 min-h-0 bg-default">
    <!-- Nobody on camera: show who's here and the quickest way to go live -->
    <div v-if="tiles.length === 0" class="absolute inset-0 flex items-center justify-center p-6">
      <UEmpty
        variant="naked"
        :title="emptyTitle"
        :description="emptyDescription"
        :actions="emptyActions"
        class="max-w-sm"
      >
        <template #leading>
          <UAvatarGroup size="lg" :max="5" class="mb-2">
            <UAvatar
              v-for="member in members"
              :key="member.identity"
              :src="useDiceBearAvatar(member.name).value"
              :alt="member.name"
            />
          </UAvatarGroup>
        </template>
      </UEmpty>
    </div>

    <TilingLayout
      v-else
      :items="tiles"
      storage-key="ramble-video-tiling"
      class="absolute inset-0"
      @open="openTile"
    >
      <template #default="{ item, isMain, makeMain }">
        <VideoTile
          :identity="item.identity"
          :name="item.name"
          :kind="item.kind"
          :is-local="item.isLocal"
          :track="trackFor(item)"
          :camera-on="participantById.get(item.identity)?.isCameraEnabled ?? false"
          :mic-on="participantById.get(item.identity)?.isMicrophoneEnabled ?? false"
          :speaking="item.kind === 'camera' && isSpeaking(item.identity)"
          :level="level(item.identity)"
          :is-main="isMain"
          @fullscreen="openTile(item.id)"
          @make-main="makeMain"
        />
      </template>
    </TilingLayout>

    <FullscreenVideoModal
      v-model:is-open="isFullscreenOpen"
      :track="fullscreen ? trackFor(fullscreen) : undefined"
      :participant-name="fullscreen?.name ?? ''"
      :participant-identity="fullscreen?.identity ?? ''"
      :track-type="fullscreen?.kind === 'screen' ? 'screen' : 'webcam'"
    />
  </div>
</template>
