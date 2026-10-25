import { ParticipantInfo_State } from 'livekit-server-sdk'
import type { RoomPresence } from '#shared/types/room'
import { getRoomServiceClient } from '../utils/livekit'

/**
 * Who's in the room right now, for the join screen. Only display names: anyone can
 * join under any free name and see the same list, so this reveals nothing more.
 */
export default defineEventHandler(async (event): Promise<RoomPresence> => {
  rateLimit(event, 'room-presence', 30, 60_000)

  try {
    const participants = await getRoomServiceClient().listParticipants(ROOM_NAME)
    const names = participants
      .filter(participant => participant.state !== ParticipantInfo_State.DISCONNECTED && !isHiddenFromChat(participant.identity))
      .map(participant => participant.name || participant.identity)
      .sort((a, b) => a.localeCompare(b))
    return { names }
  } catch (error) {
    // The room only exists while someone's in it
    if (error instanceof Error && /not.?found/i.test(error.message)) return { names: [] }
    throw error
  }
})
