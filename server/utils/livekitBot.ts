import { DataPacket_Kind } from 'livekit-server-sdk'
import { getRoomServiceClient } from './livekit'
import { getMessageBus } from './messageBus'

const encoder = new TextEncoder()

export async function sendBotMessage(
  roomName: string,
  botName: string,
  content: string
) {
  const client = getRoomServiceClient()

  const message = {
    type: 'bot',
    id: `bot-${Date.now()}-${Math.random()}`,
    userId: `bot-${botName}`,
    userName: botName,
    content,
    timestamp: Date.now(),
    metadata: { botName, isAI: true }
  }

  // Send to all participants in the room
  await client.sendData(roomName, encoder.encode(JSON.stringify(message)), DataPacket_Kind.RELIABLE, {})

  // Forward to SSE clients (ramble-daemon desktop notifications)
  getMessageBus().publish({
    type: 'message',
    author: botName,
    content,
    room: roomName,
    timestamp: message.timestamp
  })
}

// Show "<bot> is typing" in clients while a reply is being generated. Same packet
// shape as the client-side typing indicator in useLiveKitChat. Sent reliable (unlike
// people's typing) so start/stop stay ordered with the bot's reply message.
export async function sendBotTyping(roomName: string, botName: string, isTyping: boolean) {
  const packet = {
    type: 'typing',
    id: `bot-typing-${Date.now()}-${Math.random()}`,
    userId: `bot-${botName}`,
    userName: botName,
    content: isTyping ? 'start' : 'stop',
    timestamp: Date.now()
  }

  await getRoomServiceClient().sendData(roomName, encoder.encode(JSON.stringify(packet)), DataPacket_Kind.RELIABLE, {})
}
