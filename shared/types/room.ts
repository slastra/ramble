// GET /api/room-presence: display names of the people in the room (no bots, stream, or viewers)
export interface RoomPresence {
  names: string[]
}
