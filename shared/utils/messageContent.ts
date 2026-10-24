import type { ChatAttachment, MessageEnvelope } from '../types/chat'

/**
 * Split message wire content into its text and attachments. Messages with
 * attachments are JSON-encoded MessageEnvelopes; anything else is plain text.
 */
export function parseMessageContent(content: string): { text: string, attachments: ChatAttachment[] } {
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content) as MessageEnvelope
      if (parsed.type === 'message' && Array.isArray(parsed.attachments)) {
        return { text: parsed.content || '', attachments: parsed.attachments }
      }
    } catch {
      // Not an envelope, fall through to plain text
    }
  }
  return { text: content, attachments: [] }
}
