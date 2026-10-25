import type { PushEvents, PushSubscribeRequest } from '#shared/types/push'

const EVENTS_KEY = 'ramble-push-events'
const DEFAULT_EVENTS: PushEvents = { messages: true, joins: true }

export type PushSupport = 'supported' | 'unsupported' | 'unconfigured'

function loadEvents(): PushEvents {
  if (import.meta.server) return { ...DEFAULT_EVENTS }
  try {
    const saved = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '{}') as Partial<PushEvents>
    return { ...DEFAULT_EVENTS, ...saved }
  } catch {
    return { ...DEFAULT_EVENTS }
  }
}

// The VAPID public key is URL-safe base64; pushManager.subscribe wants the raw bytes
function decodeKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

let registration: Promise<ServiceWorkerRegistration> | null = null
function getRegistration(): Promise<ServiceWorkerRegistration> {
  registration ??= navigator.serviceWorker.register('/sw.js')
  return registration
}

/**
 * Browser notifications over Web Push. While you're away from the room the server pushes
 * new messages and joins to this device; while you're in it with the tab in the background,
 * `notifyLocally` shows them directly. Everything is per device and opt-in.
 *
 * `token` is the room's LiveKit token: the server takes your identity from it.
 */
export function usePushNotifications(token: Readonly<Ref<string | null>>) {
  const { vapidPublicKey } = useRuntimeConfig().public
  const support = useState<PushSupport>('pushSupport', () => 'unsupported')
  const permission = useState<NotificationPermission>('pushPermission', () => 'default')
  const subscribed = useState('pushSubscribed', () => false)
  const events = useState<PushEvents>('pushEvents', loadEvents)
  const busy = ref(false)

  const headers = () => (token.value ? { Authorization: `Bearer ${token.value}` } : undefined)

  // Read where this browser stands; call on mount
  async function refresh(): Promise<void> {
    if (!vapidPublicKey) {
      support.value = 'unconfigured'
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      support.value = 'unsupported'
      return
    }
    support.value = 'supported'
    permission.value = Notification.permission
    const existing = await (await getRegistration()).pushManager.getSubscription()
    subscribed.value = existing !== null
  }

  async function register(subscription: PushSubscription): Promise<void> {
    const body: PushSubscribeRequest = {
      subscription: subscription.toJSON() as PushSubscribeRequest['subscription'],
      events: events.value
    }
    await $fetch('/api/push/subscribe', { method: 'POST', headers: headers(), body })
  }

  async function enable(): Promise<void> {
    if (support.value !== 'supported' || busy.value) return
    busy.value = true
    try {
      permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') return
      const pushManager = (await getRegistration()).pushManager
      const subscription = await pushManager.getSubscription()
        ?? await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(vapidPublicKey) })
      await register(subscription)
      subscribed.value = true
    } finally {
      busy.value = false
    }
  }

  async function disable(): Promise<void> {
    if (busy.value) return
    busy.value = true
    try {
      const subscription = await (await getRegistration()).pushManager.getSubscription()
      if (subscription) {
        await $fetch('/api/push/unsubscribe', { method: 'POST', headers: headers(), body: { endpoint: subscription.endpoint } })
          .catch(() => {})
        await subscription.unsubscribe()
      }
      subscribed.value = false
    } finally {
      busy.value = false
    }
  }

  async function setEvents(next: PushEvents): Promise<void> {
    events.value = next
    try {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(next))
    } catch {
      // Private mode: the choice still applies until the tab closes
    }
    await sync()
  }

  // Re-send this device's subscription, so the server knows the name you joined under
  async function sync(): Promise<void> {
    if (support.value !== 'supported' || !token.value) return
    const subscription = await (await getRegistration()).pushManager.getSubscription()
    subscribed.value = subscription !== null
    if (subscription) await register(subscription)
  }

  async function sendTest(): Promise<void> {
    const subscription = await (await getRegistration()).pushManager.getSubscription()
    if (!subscription) return
    await $fetch('/api/push/test', { method: 'POST', headers: headers(), body: { endpoint: subscription.endpoint } })
  }

  /** While in the room: notify if this device opted in for `kind` and the tab is hidden. */
  async function notifyLocally(kind: keyof PushEvents, title: string, body: string): Promise<void> {
    if (!subscribed.value || !events.value[kind] || document.visibilityState === 'visible') return
    await (await getRegistration()).showNotification(title, {
      body,
      tag: kind === 'messages' ? 'chat' : 'joins',
      icon: '/android-chrome-192x192.png',
      data: { url: '/chat' }
    })
  }

  return { support, permission, subscribed, events, busy, refresh, enable, disable, setEvents, sync, sendTest, notifyLocally }
}
