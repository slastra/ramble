export default defineEventHandler(() => {
  const runtimeConfig = useRuntimeConfig()
  const ntfyUrl = runtimeConfig.ntfyUrl || 'https://ntfy.sh'
  const topic = runtimeConfig.ntfyTopic || 'chat-notifications'

  return {
    url: ntfyUrl,
    topic,
    subscriptionUrl: `${ntfyUrl}/${topic}`
  }
})
