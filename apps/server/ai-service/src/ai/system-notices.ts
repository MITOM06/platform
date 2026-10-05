import { AiMemory } from '../memory/ai-memory.schema';
import { AiTrace } from './ai.types';

/**
 * User-facing notices published as ordinary AI messages (reusing the Redis
 * stream mechanism). Backend-authored text — the plan's primary deployment
 * language is Vietnamese; the web/mobile i18n keys mirror these strings.
 */
export const NEW_SESSION_NOTICE =
  '✅ Đã bắt đầu cuộc trò chuyện mới. Cuộc trò chuyện trước đó đã được lưu lại và có thể tiếp tục sau.';
export const CONTEXT_COMPACTED_NOTICE =
  '🗜️ Ngữ cảnh đã được tóm tắt để tối ưu bộ nhớ. Lịch sử đầy đủ vẫn được lưu trong phiên trò chuyện.';
export const MEMORY_EMPTY_NOTICE =
  '🧠 Tôi chưa ghi nhớ điều gì về bạn. Hãy chat thêm một chút để tôi học được về bạn.';

/** A zeroed trace for system-authored (non-model) stream responses. */
export const SYSTEM_TRACE: AiTrace = {
  thinkingBlocks: [],
  toolCalls: [],
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  thinkingTokens: 0,
  processingMs: 0,
  model: 'system',
  iterationCount: 0,
};

/** The trace attached to an answer served from the semantic response cache. */
export const CACHE_TRACE: AiTrace = { ...SYSTEM_TRACE, model: 'cache' };

export function isMemoryCommand(content: string): boolean {
  const trimmed = content.trim();
  return trimmed === '/memory' || trimmed === '/ai-memory';
}

/**
 * `/memory` answer built from the REQUESTER's own memory doc (real stored data,
 * not a model guess). Never another member's: docs are per (conversation, user).
 */
export function formatMemoryNotice(memory: AiMemory | null): string {
  const facts = memory?.keyFacts ?? [];
  if (!memory || (!memory.summary && facts.length === 0)) return MEMORY_EMPTY_NOTICE;
  const factsText =
    facts.length > 0 ? '\n\n**Thông tin đã ghi nhớ:**\n' + facts.map((f) => `• ${f}`).join('\n') : '';
  return (
    `🧠 **Những gì tôi đã ghi nhớ về bạn (${memory.messageCount ?? 0} tin nhắn):**\n\n` +
    `${memory.summary ?? ''}` +
    factsText
  );
}
