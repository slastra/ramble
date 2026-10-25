import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import webpush, { WebPushError } from 'web-push'
import { ParticipantInfo_State } from 'livekit-server-sdk'
import type { PushEvents, PushPayload, PushSubscriptionJSON } from '#shared/types/push'
import { getRoomServiceClient } from './livekit'

// A device that asked for notifications, and who it belongs to (the identity from the
// LiveKit token it subscribed with, refreshed every time it rejoins)
export interface PushSubscriber extends PushSubscriptionJSON {
  identity: string
  events: PushEvents
  updatedAt: number
}

// Enough for a family-and-friends room; stops anyone filling the disk with subscriptions
const MAX_SUBSCRIBERS = 200

/**
 * Push subscriptions, kept in one JSON file in the data dir so they survive redeploys.
 * Loaded once, then served from memory; writes are queued and replace the file whole.
 */
class PushStore {
  private subscribers: Map<string, PushSubscriber> | null = null
  private writes: Promise<void> = Promise.resolve()

  constructor(private readonly dir: string) {}

  private get file() {
    return join(this.dir, 'push-subscriptions.json')
  }

  private async load(): Promise<Map<string, PushSubscriber>> {
    if (this.subscribers) return this.subscribers
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8')) as PushSubscriber[]
      this.subscribers = new Map(saved.map(subscriber => [subscriber.endpoint, subscriber]))
    } catch {
      // First run, or an unreadable file: start empty
      this.subscribers = new Map()
    }
    return this.subscribers
  }

  private save(subscribers: Map<string, PushSubscriber>): Promise<void> {
    const data = JSON.stringify([...subscribers.values()])
    this.writes = this.writes.then(async () => {
      await mkdir(this.dir, { recursive: true })
      const temp = `${this.file}.tmp`
      await writeFile(temp, data, { mode: 0o600 })
      await rename(temp, this.file)
    }).catch((error) => {
      console.error('[push] Failed to save subscriptions:', error)
    })
    return this.writes
  }

  async all(): Promise<PushSubscriber[]> {
    return [...(await this.load()).values()]
  }

  async get(endpoint: string): Promise<PushSubscriber | undefined> {
    return (await this.load()).get(endpoint)
  }

  /** Add or refresh a device; false when the store is full and this is a new one. */
  async upsert(subscriber: PushSubscriber): Promise<boolean> {
    const subscribers = await this.load()
    if (!subscribers.has(subscriber.endpoint) && subscribers.size >= MAX_SUBSCRIBERS) return false
    subscribers.set(subscriber.endpoint, subscriber)
    await this.save(subscribers)
    return true
  }

  async remove(endpoint: string): Promise<void> {
    const subscribers = await this.load()
    if (subscribers.delete(endpoint)) await this.save(subscribers)
  }
}

let pushStore: PushStore | null = null

export function getPushStore(): PushStore {
  if (!pushStore) pushStore = new PushStore(useRuntimeConfig().dataDir)
  return pushStore
}

let vapidConfigured = false

/** True when the VAPID keys are set (and hands them to web-push the first time). */
export function isPushEnabled(): boolean {
  const config = useRuntimeConfig()
  if (!config.public.vapidPublicKey || !config.vapidPrivateKey) return false
  if (!vapidConfigured) {
    webpush.setVapidDetails(config.vapidSubject, config.public.vapidPublicKey, config.vapidPrivateKey)
    vapidConfigured = true
  }
  return true
}

/**
 * Send one notification. Push services answer 404/410 for a subscription the browser
 * has dropped (notifications turned off, site data cleared), so forget those.
 */
export async function sendPushNotification(subscriber: PushSubscriptionJSON, payload: PushPayload, kind: keyof PushEvents): Promise<void> {
  try {
    await webpush.sendNotification(
      { endpoint: subscriber.endpoint, keys: subscriber.keys },
      JSON.stringify(payload),
      {
        // A message is stale after an hour, a join after ten minutes
        TTL: kind === 'messages' ? 3600 : 600,
        // An undelivered push with the same topic is replaced, so an offline phone
        // wakes up to the latest message rather than a backlog
        topic: kind === 'messages' ? 'chat' : 'joins'
      }
    )
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      await getPushStore().remove(subscriber.endpoint)
      return
    }
    // The endpoint is a bearer URL for that device, so it stays out of the logs
    console.error('[push] Send failed:', error instanceof WebPushError ? error.statusCode : error)
  }
}

async function identitiesInRoom(roomName: string): Promise<Set<string>> {
  try {
    const participants = await getRoomServiceClient().listParticipants(roomName)
    return new Set(participants
      .filter(participant => participant.state !== ParticipantInfo_State.DISCONNECTED)
      .map(participant => participant.identity.toLowerCase()))
  } catch {
    // No room means nobody's in it
    return new Set()
  }
}

/**
 * Notify everyone who wants this kind of event and isn't in the room right now (people
 * in the room see it there; their own tab notifies them while it's in the background).
 * Never the person who caused it.
 */
export async function pushToRoom(roomName: string, kind: keyof PushEvents, from: string, payload: PushPayload): Promise<void> {
  if (!isPushEnabled()) return
  const sender = from.toLowerCase()
  const wanting = (await getPushStore().all())
    .filter(subscriber => subscriber.events[kind] && subscriber.identity.toLowerCase() !== sender)
  if (wanting.length === 0) return

  const present = await identitiesInRoom(roomName)
  const away = wanting.filter(subscriber => !present.has(subscriber.identity.toLowerCase()))
  await Promise.allSettled(away.map(subscriber => sendPushNotification(subscriber, payload, kind)))
}
