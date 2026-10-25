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

/** One line of a message for a notification: its text, or what it shared, kept short. */
export function messagePreview(content: string, maxLength = 160): string {
  const { text, attachments } = parseMessageContent(content)
  // Notifications show plain text, so drop the markdown: links keep their text, and
  // emphasis, code and heading/quote markers go
  const plain = text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|`+)/g, '')
    .replace(/^\s*(#{1,6}|>|[-*+])\s+/gm, '')
  const preview = plain.trim().replace(/\s+/g, ' ')
    || (attachments.length === 1 ? 'Shared a file' : `Shared ${attachments.length} files`)
  return preview.length > maxLength ? `${preview.slice(0, maxLength - 1)}…` : preview
}
