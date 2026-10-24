import { getRoomServiceClient } from './livekit'

/** Display names of the real people in a room (no bots, OBS stream, or /ingress viewers). */
export async function getRoomRoster(roomName: string): Promise<string[]> {
  try {
    const participants = await getRoomServiceClient().listParticipants(roomName)
    return participants
      .filter(p => !isHiddenFromChat(p.identity))
      .map(p => p.name || p.identity)
  } catch (error) {
    console.error('[botContext] Failed to list participants:', error)
    return []
  }
}

function formatNow(timeZone: string | undefined): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }
  try {
    return new Date().toLocaleString('en-US', { ...options, timeZone, timeZoneName: 'short' })
  } catch {
    // Unknown zone from the client
    return new Date().toLocaleString('en-US', { ...options, timeZone: 'UTC', timeZoneName: 'short' })
  }
}

export interface RoomContextOptions {
  botName: string
  roster: string[]
  otherBots: string[]
  timeZone?: string
  hasImages: boolean
}

/**
 * Situational preamble appended to every bot's personality prompt: where the bot
 * is, who's around, the time, and the chat conventions the client relies on.
 */
export function buildRoomContext(options: RoomContextOptions): string {
  const { botName, roster, otherBots, timeZone, hasImages } = options

  const lines = [
    '## The room',
    `You're ${botName}, one of the AI bots in Ramble, a small group chat (with voice and video) among friends.`,
    `It's ${formatNow(timeZone)} for the person who just spoke.`
  ]
  if (roster.length > 0) {
    lines.push(`People in the room right now: ${roster.join(', ')}.`)
  }
  if (otherBots.length > 0) {
    lines.push(`Other bots here: ${otherBots.join(', ')}. They're separate characters; never speak for them.`)
  }
  lines.push(
    'People\'s messages arrive as "Name: message", and other bots\' messages look the same way.',
    'Reply with only your own message: no name prefix, and don\'t repeat the conversation back.',
    'Keep it chat-sized, usually one to three sentences, unless someone asks for detail. Markdown renders (code blocks, lists, links).'
  )
  if (hasImages) {
    lines.push('You can see the images people shared. React to what is actually in them.')
  }

  return lines.join('\n')
}
