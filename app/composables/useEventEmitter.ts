// Tiny typed pub-sub. `Events` maps each event name to its handler's arguments, e.g.
// `{ connected: [], participantConnected: [participant: RemoteParticipant] }`.
export type EventMap<Events> = { [K in keyof Events]: unknown[] }

export interface EventEmitter<Events extends EventMap<Events>> {
  emit: <K extends keyof Events>(event: K, ...args: Events[K]) => void
  on: <K extends keyof Events>(event: K, handler: (...args: Events[K]) => void) => void
  off: <K extends keyof Events>(event: K, handler: (...args: Events[K]) => void) => void
}

export function useEventEmitter<Events extends EventMap<Events>>(): EventEmitter<Events> {
  const handlers: { [K in keyof Events]?: Set<(...args: Events[K]) => void> } = {}

  function emit<K extends keyof Events>(event: K, ...args: Events[K]) {
    handlers[event]?.forEach(handler => handler(...args))
  }

  function on<K extends keyof Events>(event: K, handler: (...args: Events[K]) => void) {
    const set = handlers[event] ?? new Set<(...args: Events[K]) => void>()
    set.add(handler)
    handlers[event] = set
  }

  function off<K extends keyof Events>(event: K, handler: (...args: Events[K]) => void) {
    handlers[event]?.delete(handler)
  }

  return { emit, on, off }
}
