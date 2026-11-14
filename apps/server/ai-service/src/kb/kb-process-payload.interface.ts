/**
 * Shape published by chat-service `KbController` on the Redis `kb:process`
 * channel (verified against
 * apps/server/chat-service/.../controller/KbController.java — payload built via
 * Map.of("documentId","conversationId","userId","fileUrl","mimeType","fileName")).
 *
 * NOTE: the publisher sends `fileUrl`/`fileName` (a fetchable URL), which the
 * processor downloads via `fetch()` — not a GridFS id. Keep this interface
 * aligned with the publisher.
 */
export interface KbProcessPayload {
  documentId: string;
  conversationId: string;
  userId: string;
  fileUrl: string;
  mimeType: string;
  fileName: string;
  /** Owning department id (P6 dept-scoped RAG); absent for personal chats. */
  departmentId?: string;
}
