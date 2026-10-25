// Which room events a device wants pushed
export interface PushEvents {
  messages: boolean
  joins: boolean
}

// A browser's push subscription as PushSubscription.toJSON() gives it
export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string, auth: string }
}

// POST /api/push/subscribe
export interface PushSubscribeRequest {
  subscription: PushSubscriptionJSON
  events: PushEvents
}

// POST /api/push/unsubscribe and /api/push/test
export interface PushEndpointRequest {
  endpoint: string
}

// What the service worker receives and shows
export interface PushPayload {
  title: string
  body: string
  // Notifications with the same tag replace each other instead of piling up
  tag: string
  url: string
}
