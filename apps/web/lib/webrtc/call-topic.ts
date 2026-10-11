import { stompService } from '@/lib/stomp/client'
import { chatService } from '@/lib/api/chat'
import type { CallEvent } from '@/lib/api/types'

/** Can the browser open the mic (and camera)? Releases the probe at once. */
export async function canOpenMedia(video: boolean): Promise<boolean> {
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    probe.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

/**
 * `call.started` / `call.ended` of a conversation, heard even while its chat
 * thread is closed (the call keeps its own subscription for its lifetime).
 * Durable: re-attached after every STOMP reconnect (and attached on the next
 * connect when the socket is down right now), so a blip never makes a call
 * miss its own start or end.
 */
export function subscribeCallEvents(
  conversationId: string,
  onEvent: (event: CallEvent) => void,
): { unsubscribe: () => void } {
  const unsubscribe = stompService.subscribeDurable(`/topic/conversation/${conversationId}`, (frame) => {
    try {
      const event = JSON.parse(frame.body) as { event?: string }
      if (event.event === 'call.started' || event.event === 'call.ended') onEvent(event as CallEvent)
    } catch {
      // not JSON — ignore
    }
  })
  return { unsubscribe }
}

/** The call's line in the chat history — best-effort, never blocks a hang-up. */
export function sendCallLog(conversationId: string, content: string): void {
  chatService.sendMessage(conversationId, content, 'system').catch(() => {})
}
