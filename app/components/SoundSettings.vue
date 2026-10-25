<script setup lang="ts">
import type { SoundEvent } from '~/composables/useSoundManager'

const { enabled, volume, soundConfig, setSoundForEvent, resetToDefaults, availableSounds } = useSoundSettings()
const { playSound, canPlayAudio, enableAudio } = useSoundManager()

// Sound event labels for better UX
const soundEventLabels: Record<SoundEvent, string> = {
  messageReceived: 'Message received',
  messageSent: 'Message sent',
  aiResponse: 'Bot reply',
  userJoined: 'Someone joined',
  userLeft: 'Someone left',
  error: 'Error',
  notification: 'Notification'
}

// Test a specific sound
const testSound = async (event: SoundEvent) => {
  if (!canPlayAudio.value) {
    await enableAudio()
  }
  playSound(event, volume.value)
}

// Handle volume change
const handleVolumeChange = (newVolume: number) => {
  volume.value = newVolume
}
</script>

<template>
  <div class="space-y-5">
    <USwitch
      v-model="enabled"
      label="Sound effects"
      description="Play a sound for new messages, bot replies, joins and leaves."
    />

    <UAlert
      v-if="enabled && !canPlayAudio"
      icon="i-lucide-volume-x"
      color="warning"
      variant="subtle"
      title="Your browser is blocking sound"
      description="Allow it once and Ramble can play sounds for this visit."
      :actions="[{ label: 'Allow sound', color: 'warning', variant: 'solid', size: 'xs', onClick: () => { enableAudio() } }]"
    />

    <template v-if="enabled">
      <UFormField :label="`Volume · ${Math.round(volume * 100)}%`">
        <USlider
          v-model="volume"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="(val) => handleVolumeChange(val as number)"
        />
      </UFormField>

      <div class="divide-y divide-default">
        <div
          v-for="(event, eventKey) in soundEventLabels"
          :key="eventKey"
          class="flex items-center justify-between gap-3 py-2 first:pt-0"
        >
          <span class="text-sm">{{ event }}</span>
          <UFieldGroup size="sm">
            <USelect
              v-model="soundConfig[eventKey as SoundEvent]"
              :items="availableSounds"
              class="w-36"
              @update:model-value="(value: string) => setSoundForEvent(eventKey as SoundEvent, value)"
            />
            <UTooltip text="Play">
              <UButton
                icon="i-lucide-play"
                color="neutral"
                variant="subtle"
                :aria-label="`Play the ${event} sound`"
                @click="testSound(eventKey as SoundEvent)"
              />
            </UTooltip>
          </UFieldGroup>
        </div>
      </div>

      <UButton
        label="Reset to defaults"
        icon="i-lucide-rotate-ccw"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="resetToDefaults"
      />
    </template>
  </div>
</template>
