<script setup lang="ts">
const { setUserName, clientId, userName } = useUser()
const loading = ref(false)
const error = ref('')
const suggestions = ref<string[]>([])

const state = reactive({
  name: userName.value || '' // Pre-fill with stored username
})

// Returning visitors (stored name) get a greeting instead of the pitch
const returningName = userName.value || ''

async function validateAndJoin() {
  if (!state.name.trim()) return
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
        username: state.name.trim(),
        clientId: clientId.value
      }
    })

    if (!validation.valid) {
      error.value = validation.message || 'Username is not available'
      suggestions.value = ('suggestions' in validation && validation.suggestions) ? validation.suggestions : []
      loading.value = false
      return
    }

    // Username is valid, proceed to join
    setUserName(state.name.trim())
    await navigateTo('/chat')
  } catch (err) {
    console.error('Failed to validate username:', err)
    error.value = 'Failed to check username availability. Please try again.'
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
        <!-- A soft coral glow behind the form -->
        <div
          aria-hidden="true"
          class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[36rem] rounded-full bg-primary/15 blur-3xl"
        />

        <div class="relative w-full max-w-sm space-y-8">
          <div class="text-center space-y-2">
            <h1 class="logo text-6xl text-highlighted">
              Ramble
            </h1>
            <p class="text-muted">
              <template v-if="returningName">
                Welcome back, {{ returningName }}.
              </template>
              <template v-else>
                Drop in, talk it out, bring your bots.
              </template>
            </p>
          </div>

          <form class="space-y-3" @submit.prevent="validateAndJoin">
            <UFormField :error="error || undefined">
              <UInput
                v-model="state.name"
                placeholder="What should we call you?"
                aria-label="Your Name"
                icon="i-lucide-user-round"
                size="xl"
                autofocus
                autocomplete="nickname"
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
              :disabled="!state.name.trim()"
            />
          </form>

          <p class="text-center text-xs text-dimmed">
            No account needed. Your name is remembered on this browser.
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
