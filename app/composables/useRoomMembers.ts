import type { LiveKitParticipant, UseLiveKitRoomReturn } from './useLiveKitRoom'

export interface RoomMember {
  identity: string
  name: string
  isLocal: boolean
  participant: LiveKitParticipant
}

/**
 * The people in the room as the chat shows them: you first, then everyone else by
 * name. Bots, the OBS stream, and /ingress viewers are left out (isHiddenFromChat).
 */
export function useRoomMembers(liveKitRoom: UseLiveKitRoomReturn) {
  const members = computed((): RoomMember[] => {
    const local = liveKitRoom.localParticipant.value
    const toMember = (participant: LiveKitParticipant, isLocal: boolean): RoomMember => ({
      identity: participant.identity,
      name: participant.name || participant.identity,
      isLocal,
      participant
    })

    const others = liveKitRoom.remoteParticipants.value
      .filter(participant => !isHiddenFromChat(participant.identity))
      .map(participant => toMember(participant, false))
      .sort((a, b) => a.name.localeCompare(b.name))

    return local && !isHiddenFromChat(local.identity) ? [toMember(local, true), ...others] : others
  })

  return { members }
}
