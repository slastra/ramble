import { TokenVerifier } from 'livekit-server-sdk'

// Public endpoints that don't require LiveKit token auth
const PUBLIC_PATHS = [
  '/api/livekit-token',
  '/api/validate-username',
  '/api/bots',
  '/api/ntfy-config',
  '/api/download/',
  '/api/events'
]

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some(p => path.startsWith(p))
}

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only apply to /api/ routes
  if (!path.startsWith('/api/')) return

  // Skip public endpoints
  if (isPublicPath(path)) return

  // Extract Bearer token
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing or invalid Authorization header'
    })
  }

  const token = authHeader.slice(7)

  const config = useRuntimeConfig()
  const { livekitKey, livekitSecret } = config

  if (!livekitKey || !livekitSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'LiveKit credentials not configured'
    })
  }

  try {
    const verifier = new TokenVerifier(livekitKey, livekitSecret)
    const claims = await verifier.verify(token)
    // Attach identity from verified claims to event context
    event.context.livekitIdentity = claims.sub || claims.name
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired token'
    })
  }
})
