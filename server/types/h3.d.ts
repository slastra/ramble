// Set by server/middleware/livekit-auth.ts from the verified LiveKit token
declare module 'h3' {
  interface H3EventContext {
    livekitIdentity?: string
    livekitRoom?: string
  }
}

export {}
