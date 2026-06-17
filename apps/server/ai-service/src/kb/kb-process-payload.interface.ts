/**
 * Shape published by chat-service `KbController` on the Redis `kb:process`
 * channel (verified against
 * apps/server/chat-service/.../controller/KbController.java — payload built via
 * Map.of("documentId","conversationId","userId","fileUrl","mimeType","fileName")).
 *
 * NOTE: root CLAUDE.md documents `{gridfsId, filename, mimeType}` for this
 * channel — that doc is STALE. The real publisher sends `fileUrl`/`fileName`
 * (a fetchable URL), which the processor downloads via `fetch()`. Keep this
 * interface aligned with the publisher, not the doc.
 */
export interface KbProcessPayload {
  documentId: string;
  conversationId: string;
  userId: string;
  fileUrl: string;
  mimeType: string;
  fileName: string;
}
