<script setup lang="ts">
import type { RoomPresence } from '#shared/types/room'

const { setUserName, clearUser, clientId, userName } = useUser()
const loading = ref(false)
const error = ref('')
const suggestions = ref<string[]>([])

const state = reactive({
  name: userName.value || '' // Pre-fill with stored username
})

// Returning visitors (stored name) get a greeting instead of the pitch
const returningName = ref(userName.value || '')

const nameInput = useTemplateRef('nameInput')

// Topographic contours for the backdrop: lines stacked down the page that bunch and spread
// and bend around a ridge and a valley, like a hillside on a map with no peak in view.
// Each term changes only a little from one line to the next, so neighbours never cross;
// time moves every line the same way, so that holds while it flows.
const bump = (x: number, at: number, width: number) => Math.exp(-(((x - at) / width) ** 2))
function contoursAt(t: number): string[] {
  const ridgeAt = 820 + 120 * Math.sin(t * 0.07)
  const valleyAt = 260 - 90 * Math.sin(t * 0.05 + 1)
  return Array.from({ length: 48 }, (_, line) => {
    const swell = 20 + 12 * Math.sin(line * 0.23)
    const points = Array.from({ length: 121 }, (_, i) => {
      const x = -450 + i * 17.5
      const y = -330 + line * 30 + 30 * Math.sin(line * 0.18)
        + 60 * bump(x, ridgeAt, 260) * Math.sin(line * 0.16)
        - 50 * bump(x, valleyAt, 200) * Math.cos(line * 0.13 + 0.5)
        + swell * Math.sin(x * 0.0047 + line * 0.06 + t * 0.12)
        + 6 * Math.sin(x * 0.011 + 2.1 + line * 0.09 - t * 0.2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return `M${points.join('L')}`
  })
}

// Flow slowly at 30fps; rAF already pauses in background tabs. Still for reduced motion.
const contours = shallowRef(contoursAt(0))
const reducedMotion = usePreferredReducedMotion()
const flow = useRafFn(({ timestamp }) => {
  contours.value = contoursAt(timestamp / 1000)
}, { fpsLimit: 30, immediate: false })
watch(reducedMotion, (motion) => {
  if (motion === 'reduce') flow.pause()
  else flow.resume()
}, { immediate: true })

function notYou() {
  clearUser()
  returningName.value = ''
  state.name = ''
  error.value = ''
  suggestions.value = []
  nextTick(() => nameInput.value?.inputRef?.focus())
}

// Your avatar as you type it, the same one everyone in the room will see
const trimmedName = computed(() => state.name.trim())
const avatarPreview = computed(() => useDiceBearAvatar(trimmedName.value).value)

// Who's in the room, refreshed while the page is visible
const { data: presence, refresh: refreshPresence } = useFetch<RoomPresence>('/api/room-presence', {
  lazy: true,
  server: false
})
const visibility = useDocumentVisibility()
useIntervalFn(() => {
  if (visibility.value === 'visible') refreshPresence()
}, 20_000)
watch(visibility, (now) => {
  if (now === 'visible') refreshPresence()
})

const present = computed(() => presence.value?.names ?? [])
const presenceText = computed(() => {
  const names = present.value
  if (names.length === 0) return 'Nobody\'s here yet. Start things off.'
  if (names.length === 1) return `${names[0]} is here`
  if (names.length === 2) return `${names[0]} and ${names[1]} are here`
  // Kept short enough to stay on one line beside the avatars
  const others = names.length - 2
  return `${names[0]}, ${names[1]} and ${others} ${others === 1 ? 'other' : 'others'}`
})

async function validateAndJoin() {
  if (!trimmedName.value) return
  if (loading.value) return

  loading.value = true
  error.value = ''
  suggestions.value = []

  try {
    // Validate username availability
    const validation = await $fetch('/api/validate-username', {
      method: 'POST',
      body: {
        roomName: ROOM_NAME,
        username: trimmedName.value,
        clientId: clientId.value
      }
    })

    if (!validation.valid) {
      error.value = validation.message || 'That name isn\'t available'
      suggestions.value = ('suggestions' in validation && validation.suggestions) ? validation.suggestions : []
      loading.value = false
      return
    }

    // Username is valid, proceed to join
    setUserName(trimmedName.value)
    await navigateTo('/chat')
  } catch (err) {
    console.error('Failed to validate username:', err)
    error.value = 'Couldn\'t reach the room. Try again in a moment.'
    loading.value = false
  }
}

function useSuggestion(suggestion: string) {
  state.name = suggestion
  error.value = ''
  suggestions.value = []
}
</script>

<template>
  <UDashboardPanel id="home" :ui="{ body: 'p-0 sm:p-0' }">
    <template #body>
      <div class="relative flex-1 flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
        <!-- Mesh gradient: five colour points that drift out of step, with grain against banding -->
        <div aria-hidden="true" class="mesh pointer-events-none absolute inset-0" />
        <div aria-hidden="true" class="grain pointer-events-none absolute inset-0" />
        <svg
          aria-hidden="true"
          class="contours pointer-events-none absolute inset-0 size-full"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
        >
          <!-- Tilted, and drawn bigger than the view so the corners stay covered -->
          <g transform="rotate(-28 600 400)">
            <path v-for="(d, i) in contours" :key="i" :d="d" />
          </g>
        </svg>

        <div class="relative w-full max-w-sm space-y-8">
          <div class="rise text-center space-y-2">
            <h1 class="logo text-6xl text-highlighted">
              Ramble
            </h1>
            <p class="text-muted">
              <template v-if="returningName">
                Welcome back, {{ returningName }}.
                <UButton
                  label="Not you?"
                  variant="link"
                  color="neutral"
                  size="md"
                  class="p-0 align-baseline underline-offset-4 hover:underline"
                  @click="notYou"
                />
              </template>
              <template v-else>
                Ephemeral conferencing.
              </template>
            </p>
          </div>

          <!-- Who's in there; reserves its height so the form doesn't jump when it loads -->
          <div class="rise flex h-9 justify-center" style="animation-delay: 60ms">
            <Transition
              enter-active-class="transition duration-300 ease-out"
              enter-from-class="opacity-0 translate-y-1"
            >
              <div
                v-if="presence"
                role="status"
                class="flex max-w-full items-center gap-2.5 rounded-full bg-elevated/70 py-1 pr-3.5 ring ring-default backdrop-blur-sm"
                :class="present.length ? 'pl-1' : 'pl-3.5'"
              >
                <template v-if="present.length">
                  <UAvatarGroup size="xs" :max="4">
                    <UAvatar
                      v-for="name in present"
                      :key="name"
                      :src="useDiceBearAvatar(name).value"
                      :alt="name"
                    />
                  </UAvatarGroup>
                  <span class="relative flex size-2 shrink-0" aria-hidden="true">
                    <span class="absolute inset-0 rounded-full bg-success motion-safe:animate-ping opacity-60" />
                    <span class="relative size-2 rounded-full bg-success" />
                  </span>
                </template>
                <span class="min-w-0 truncate text-sm text-toned">{{ presenceText }}</span>
              </div>
            </Transition>
          </div>

          <form class="rise mx-auto max-w-xs space-y-3" style="animation-delay: 120ms" @submit.prevent="validateAndJoin">
            <UFormField :error="error || undefined">
              <UInput
                ref="nameInput"
                v-model="state.name"
                placeholder="What should we call you?"
                aria-label="Your Name"
                :icon="avatarPreview ? undefined : 'i-lucide-user-round'"
                :avatar="avatarPreview ? { src: avatarPreview, alt: '' } : undefined"
                size="xl"
                autofocus
                autocomplete="nickname"
                maxlength="50"
                :disabled="loading"
                class="w-full"
                @input="error = ''"
              />
            </UFormField>

            <div v-if="suggestions.length > 0" class="flex flex-wrap items-center gap-2">
              <span class="text-sm text-muted">Try</span>
              <UButton
                v-for="suggestion in suggestions"
                :key="suggestion"
                :label="suggestion"
                size="xs"
                color="neutral"
                variant="subtle"
                @click="useSuggestion(suggestion)"
              />
            </div>

            <UButton
              type="submit"
              label="Join Chat"
              trailing-icon="i-lucide-arrow-right"
              size="xl"
              block
              :loading="loading"
              :disabled="!trimmedName"
              :ui="{ trailingIcon: 'ms-0' }"
            />
          </form>

          <p class="rise text-center text-xs text-dimmed text-balance" style="animation-delay: 180ms">
            Made with
            <ULink to="https://nuxt.com" target="_blank" class="text-muted hover:text-highlighted">Nuxt</ULink>
            and
            <ULink to="https://livekit.io" target="_blank" class="text-muted hover:text-highlighted">LiveKit</ULink>
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
/* One staggered rise on load; each block sets its own delay */
@media (prefers-reduced-motion: no-preference) {
  .rise {
    animation: rise 500ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
}

/* Animatable mesh points: typed custom properties can be interpolated, plain ones can't */
@property --m1x { syntax: '<percentage>'; inherits: false; initial-value: 8%; }
@property --m1y { syntax: '<percentage>'; inherits: false; initial-value: 12%; }
@property --m2x { syntax: '<percentage>'; inherits: false; initial-value: 88%; }
@property --m2y { syntax: '<percentage>'; inherits: false; initial-value: 22%; }
@property --m3x { syntax: '<percentage>'; inherits: false; initial-value: 72%; }
@property --m3y { syntax: '<percentage>'; inherits: false; initial-value: 92%; }
@property --m4x { syntax: '<percentage>'; inherits: false; initial-value: 18%; }
@property --m4y { syntax: '<percentage>'; inherits: false; initial-value: 84%; }

/* Mostly the page background, with soft pools of the theme's neutral tokens: a wide one
   top left, the strongest bottom right, and a little haze along the bottom. The tokens
   step away from the background in both modes (darker in light, lighter in dark), so the
   pools read as shade by day and glow by night. Each fades on an eased curve, not a
   straight ramp, so no edge shows. */
.mesh {
  --light: var(--ui-bg-elevated);
  --haze: var(--ui-bg-muted);
  --shade: var(--ui-bg-accented);
  background-color: var(--ui-bg);
  background-image:
    radial-gradient(70% 65% at var(--m1x) var(--m1y),
      color-mix(in oklch, var(--light) 95%, transparent),
      color-mix(in oklch, var(--light) 55%, transparent) 30%,
      color-mix(in oklch, var(--light) 18%, transparent) 60%,
      transparent 100%),
    radial-gradient(55% 50% at var(--m2x) var(--m2y),
      color-mix(in oklch, var(--haze) 80%, transparent),
      color-mix(in oklch, var(--haze) 40%, transparent) 35%,
      transparent 100%),
    radial-gradient(75% 70% at var(--m3x) var(--m3y),
      color-mix(in oklch, var(--shade) 60%, transparent),
      color-mix(in oklch, var(--shade) 30%, transparent) 30%,
      color-mix(in oklch, var(--shade) 10%, transparent) 60%,
      transparent 100%),
    radial-gradient(50% 45% at var(--m4x) var(--m4y),
      color-mix(in oklch, var(--haze) 60%, transparent),
      color-mix(in oklch, var(--haze) 25%, transparent) 40%,
      transparent 100%),
    linear-gradient(to bottom, transparent 45%, color-mix(in oklch, var(--haze) 55%, transparent));
}

/* Contour lines in the theme's border colour, fading out toward the bottom */
.contours {
  fill: none;
  stroke: var(--ui-border-accented);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  mask-image: linear-gradient(to bottom, black 30%, transparent 95%);
  opacity: 0.8;
}

.grain {
  opacity: 0.06;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.grain:where(.dark *) {
  opacity: 0.1;
}

@media (prefers-reduced-motion: no-preference) {
  .mesh {
    animation: mesh 48s ease-in-out infinite alternate;
  }
}

@keyframes mesh {
  50% {
    --m1x: 16%; --m1y: 4%;
    --m2x: 82%; --m2y: 14%;
    --m3x: 84%; --m3y: 96%;
    --m4x: 12%; --m4y: 74%;
  }

  100% {
    --m1x: 4%; --m1y: 18%;
    --m2x: 92%; --m2y: 28%;
    --m3x: 66%; --m3y: 88%;
    --m4x: 24%; --m4y: 90%;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
</style>
