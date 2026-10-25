<script setup lang="ts">
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client'

const props = defineProps<{
  identity: string
  name: string
  kind: 'camera' | 'screen'
  isLocal: boolean
  track?: RemoteVideoTrack | LocalVideoTrack
  cameraOn: boolean
  micOn: boolean
  speaking: boolean
  // Smoothed 0..1 audio level, for the camera-off glow
  level: number
  isMain: boolean
}>()

const emit = defineEmits<{
  fullscreen: []
  makeMain: []
}>()

const showVideo = computed(() => props.kind === 'screen' || (props.cameraOn && !!props.track))
const label = computed(() => {
  if (props.kind === 'screen') return `${props.name}'s screen`
  return props.isLocal ? `${props.name} (you)` : props.name
})
const avatar = computed(() => useDiceBearAvatar(props.name).value)

// Your own camera is mirrored, like a mirror; screens are letterboxed, never cropped
const videoClass = computed(() => [
  'absolute inset-0 size-full',
  props.kind === 'screen' ? 'object-contain bg-black' : 'object-cover',
  props.kind === 'camera' && props.isLocal ? '-scale-x-100' : ''
].join(' '))

const glowStyle = computed(() => ({
  transform: `scale(${1 + props.level * 1.4})`,
  opacity: Math.min(1, props.level * 2.5)
}))

// Plate and buttons sit on top of video, so they carry their own dark backing
const overlayButton = 'bg-black/55 text-white hover:bg-black/75 backdrop-blur-sm'
</script>

<template>
  <div
    class="group/tile relative size-full overflow-hidden rounded-xl bg-elevated ring transition-shadow duration-200"
    :class="speaking ? 'ring-2 ring-primary' : 'ring-default'"
  >
    <VideoTrack
      v-if="showVideo"
      :track="track"
      :participant-identity="identity"
      :is-local="isLocal"
      :clickable="false"
      :class-name="videoClass"
    />

    <!-- Camera off: their avatar, glowing with their voice -->
    <div v-else class="absolute inset-0 grid place-items-center bg-linear-to-br from-elevated to-accented/60">
      <div class="relative">
        <div
          class="absolute inset-0 rounded-full bg-primary/40 blur-xl transition-[transform,opacity] duration-75"
          :style="glowStyle"
          aria-hidden="true"
        />
        <UAvatar
          :src="avatar"
          :alt="name"
          class="relative size-20 sm:size-24 ring-4 ring-default"
        />
      </div>
    </div>

    <!-- Who this is -->
    <div class="absolute bottom-2 left-2 flex max-w-[calc(100%-3rem)] items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium" :class="overlayButton">
      <UIcon v-if="kind === 'screen'" name="i-lucide-monitor" class="size-3.5 shrink-0" />
      <UIcon v-else-if="!micOn" name="i-lucide-mic-off" class="size-3.5 shrink-0 text-error" />
      <span class="truncate">{{ label }}</span>
    </div>

    <!-- Hover / focus actions; data-tile-ignore keeps presses on them from dragging the tile -->
    <div
      data-tile-ignore
      class="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100"
    >
      <UTooltip v-if="!isMain" text="Make main">
        <UButton
          icon="i-lucide-pin"
          size="xs"
          color="neutral"
          variant="ghost"
          :class="overlayButton"
          aria-label="Make main tile"
          @click="emit('makeMain')"
        />
      </UTooltip>
      <UTooltip text="Full screen">
        <UButton
          icon="i-lucide-maximize-2"
          size="xs"
          color="neutral"
          variant="ghost"
          :class="overlayButton"
          aria-label="Full screen"
          @click="emit('fullscreen')"
        />
      </UTooltip>
    </div>

    <VideoStats
      v-if="showVideo"
      :track="track"
      :is-local="isLocal"
      class="absolute left-2 top-2 opacity-0 transition-opacity group-hover/tile:opacity-100"
    />
  </div>
</template>
