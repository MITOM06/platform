export const WSEvents = {
  CONNECTED: 'connected',
  SEND_MESSAGE: 'message.send',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_READ: 'message.read',
  TYPING: 'typing',
  PRESENCE: 'presence'
} as const;
export type WSEventName = typeof WSEvents[keyof typeof WSEvents];
