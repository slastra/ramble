// Ramble's service worker: shows Web Push notifications and opens Ramble when one is
// clicked. It caches nothing; the app works the same without it.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil((async () => {
    // Someone looking at Ramble right now already sees what's happening
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (windows.some(client => client.focused && client.visibilityState === 'visible')) return

    await self.registration.showNotification(data.title || 'Ramble', {
      body: data.body || '',
      tag: data.tag || 'ramble',
      renotify: true,
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      data: { url: data.url || '/' }
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    // Bring back an open Ramble tab if there is one, otherwise open a new one
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (open) return open.focus()
    return self.clients.openWindow(url)
  })())
})
