/**
 * Composable to sync web app focus state with ramble-daemon
 * Enables smart notification suppression when app is active
 */
export function useDaemonSync(chatVisible?: Ref<boolean>) {
  const config = useRuntimeConfig()
  const daemonUrl = config.public.daemonUrl as string
  const enabled = (config.public.daemonEnabled as boolean | string) !== false

  // Track activity state
  let heartbeatInterval: NodeJS.Timeout | null = null
  let isActive = false
  const isDaemonConnected = ref(false)

  /**
   * Send status update to daemon
   */
  async function sendStatus(endpoint: 'active' | 'inactive' | 'heartbeat'): Promise<void> {
    if (!enabled) return

    try {
      await $fetch(`${daemonUrl}/${endpoint}`, {
        method: 'POST',
        timeout: 1000, // Short timeout - daemon should be local
        // Ignore response, fire-and-forget
        onResponseError: () => {
          isDaemonConnected.value = false
        }
      })
      isDaemonConnected.value = true
    } catch {
      isDaemonConnected.value = false
      // Silently fail if daemon not running
      // This is expected behavior when daemon is not installed/running
    }
  }

  /**
   * Mark app as active and start heartbeat
   */
  function setActive() {
    if (isActive) return
    isActive = true

    // Notify daemon
    sendStatus('active')

    // Start heartbeat interval (15 seconds)
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    heartbeatInterval = setInterval(() => {
      sendStatus('heartbeat')
    }, 15000)
  }

  /**
   * Mark app as inactive and stop heartbeat
   */
  function setInactive() {
    if (!isActive) return
    isActive = false

    // Notify daemon
    sendStatus('inactive')

    // Stop heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  /**
   * Check if window is focused and chat visible, then update daemon status
   */
  function checkFocus() {
    const documentVisible = !document.hidden
    const windowFocused = document.hasFocus()
    const isChatVisible = chatVisible?.value ?? true

    // App is active when document is visible AND window is focused AND chat is visible
    const appActive = documentVisible && windowFocused && isChatVisible

    if (appActive) {
      setActive()
    } else {
      setInactive()
    }
  }

  // Watch chat visibility changes
  if (chatVisible) {
    watch(chatVisible, checkFocus)
  }

  // Setup event listeners
  onMounted(() => {
    if (!enabled) {
      // If daemon is disabled, mark as disconnected
      isDaemonConnected.value = false
      return
    }

    // Listen for visibility changes (tab switch, minimize)
    document.addEventListener('visibilitychange', checkFocus)

    // Listen for window focus/blur
    window.addEventListener('focus', checkFocus)
    window.addEventListener('blur', checkFocus)

    // Initial check
    checkFocus()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    if (!enabled) return

    // Remove event listeners
    document.removeEventListener('visibilitychange', checkFocus)
    window.removeEventListener('focus', checkFocus)
    window.removeEventListener('blur', checkFocus)

    // Stop heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }

    // Send final inactive status
    sendStatus('inactive')
  })

  return {
    isActive: readonly(ref(isActive)),
    isDaemonConnected: readonly(isDaemonConnected)
  }
}
