# Plan: AI Memory Management + Session UI

> **Ngày:** 2026-07-02  
> **Scope:** ai-service (NestJS) + chat-service (Spring Boot) + Web (Next.js) + Mobile (Flutter)  
> **Tính năng lớn, implement theo phase.**

---

## Tổng quan kiến trúc

3 cơ chế memory (implement theo thứ tự ưu tiên):

| Phase | Cơ chế | Độ phức tạp | Value |
|-------|---------|-------------|-------|
| 1 | Explicit reset (`/new`) + Session persistence (MongoDB) | Thấp | Cao |
| 2 | Session list UI (xem, resume, rename) | Trung | Cao |
| 3 | Auto-summarize (compact) khi gần token limit | Cao | Rất cao |

**Sliding window không implement làm primary** — silently drops context, bad UX. Chỉ dùng làm hard safety fallback trong ai-service khi auto-summarize fail.

---

## Data model

### MongoDB: `ai_sessions` collection

**File**: `packages/database/src/mongo/ai-session.schema.ts` (tạo mới)

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type AiSessionDocument = AiSession & Document

export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

@Schema({ timestamps: true, collection: 'ai_sessions' })
export class AiSession {
  @Prop({ required: true, index: true })
  userId: string

  @Prop({ required: true, index: true })
  conversationId: string  // ID của conversation trong chat-service

  @Prop({ required: true, default: 'New conversation' })
  name: string  // Auto-generated từ first message content

  @Prop({ type: [Object], default: [] })
  messages: SessionMessage[]  // Full history của session này

  @Prop({ type: String, default: null })
  summary: string | null  // Summary nếu đã được compact

  @Prop({ default: false })
  isActive: boolean  // Session đang active (chỉ 1 session active / conversation)

  @Prop({ default: 0 })
  totalTokens: number  // Estimated token count để trigger auto-summarize

  @Prop()
  createdAt: Date

  @Prop()
  updatedAt: Date
}

export const AiSessionSchema = SchemaFactory.createForClass(AiSession)
// Compound index: nhanh khi query sessions của 1 user trong 1 conversation
AiSessionSchema.index({ userId: 1, conversationId: 1, isActive: -1 })
```

---

## Phase 1 — Explicit reset + Session persistence

### 1a — ai-service: Tạo `AiSessionService`

**File**: `apps/server/ai-service/src/session/ai-session.service.ts`

```typescript
@Injectable()
export class AiSessionService {
  constructor(
    @InjectModel(AiSession.name) private model: Model<AiSessionDocument>,
    private readonly claudeClient: ClaudeClientService,
  ) {}

  /** Lấy session active hiện tại, hoặc tạo mới nếu chưa có */
  async getOrCreateActiveSession(
    userId: string,
    conversationId: string,
  ): Promise<AiSessionDocument> {
    let session = await this.model.findOne({
      userId,
      conversationId,
      isActive: true,
    })
    if (!session) {
      session = await this.model.create({
        userId,
        conversationId,
        name: 'New conversation',
        messages: [],
        isActive: true,
        totalTokens: 0,
      })
    }
    return session
  }

  /** Append message vào session active */
  async appendMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void> {
    const estimatedTokens = Math.ceil(content.length / 4)  // rough estimate
    await this.model.updateOne(
      { _id: sessionId },
      {
        $push: { messages: { role, content, createdAt: new Date() } },
        $inc: { totalTokens: estimatedTokens },
      },
    )
    // Auto-name session từ first user message (bất đồng bộ, không block)
    const session = await this.model.findById(sessionId).select('messages name')
    if (session && session.messages.length === 1 && session.name === 'New conversation') {
      void this.autoNameSession(session)
    }
  }

  /** Deactivate session hiện tại, tạo session mới (user gọi /new) */
  async createNewSession(
    userId: string,
    conversationId: string,
  ): Promise<AiSessionDocument> {
    await this.model.updateMany(
      { userId, conversationId, isActive: true },
      { $set: { isActive: false } },
    )
    return this.model.create({
      userId,
      conversationId,
      name: 'New conversation',
      messages: [],
      isActive: true,
      totalTokens: 0,
    })
  }

  /** Resume một session cũ (deactivate current → activate target) */
  async resumeSession(
    sessionId: string,
    userId: string,
    conversationId: string,
  ): Promise<AiSessionDocument | null> {
    const target = await this.model.findOne({ _id: sessionId, userId, conversationId })
    if (!target) return null

    await this.model.updateMany(
      { userId, conversationId, isActive: true },
      { $set: { isActive: false } },
    )
    target.isActive = true
    await target.save()
    return target
  }

  /** List tất cả sessions của user trong 1 conversation, newest first */
  async listSessions(
    userId: string,
    conversationId: string,
  ): Promise<AiSessionDocument[]> {
    return this.model
      .find({ userId, conversationId })
      .sort({ isActive: -1, updatedAt: -1 })
      .select('name isActive totalTokens createdAt updatedAt summary')
      .limit(50)
  }

  /** Build message history để gửi lên Claude API */
  async buildMessageHistory(
    session: AiSessionDocument,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    if (session.summary) {
      // Session đã được compact: prepend summary như một system context
      return [
        {
          role: 'user',
          content: `[Context from earlier conversation]\n${session.summary}`,
        },
        { role: 'assistant', content: 'Understood. I have the context from our earlier conversation.' },
        ...session.messages.map((m) => ({ role: m.role, content: m.content })),
      ]
    }
    return session.messages.map((m) => ({ role: m.role, content: m.content }))
  }

  /** Auto-name session từ first message dùng Claude Haiku */
  private async autoNameSession(session: AiSessionDocument): Promise<void> {
    try {
      const firstMessage = session.messages[0]?.content ?? ''
      const name = await this.claudeClient.generateTitle(firstMessage)
      await this.model.updateOne({ _id: session._id }, { $set: { name } })
    } catch {
      // Non-critical: keep 'New conversation' if naming fails
    }
  }
}
```

### 1b — ai-service: Detect `/new` command

Trong `ai.service.ts` (hoặc `MessageConsumerService`), trước khi xử lý message:

```typescript
// Trong handleAiRequest():
if (payload.content.trim() === '/new') {
  const session = await this.aiSessionService.createNewSession(
    payload.userId,
    payload.conversationId,
  )
  // Trả về response đặc biệt — không gọi Claude
  await this.publishSystemResponse(
    payload.conversationId,
    `✅ Đã bắt đầu cuộc trò chuyện mới. Session cũ đã được lưu lại.`,
  )
  return
}
```

### 1c — ai-service: Integrate session vào main AI flow

Trong `handleAiRequest()`, thay `payload.history` bằng session history từ DB:

```typescript
const session = await this.aiSessionService.getOrCreateActiveSession(
  payload.userId,
  payload.conversationId,
)

// Build history từ session (có handle summary nếu đã compact)
const messageHistory = await this.aiSessionService.buildMessageHistory(session)

// Append user message vào session
await this.aiSessionService.appendMessage(session._id.toString(), 'user', payload.content)

// Gọi Claude với session history
const response = await this.claudeService.chat(payload.content, messageHistory, ...)

// Append AI response vào session
await this.aiSessionService.appendMessage(session._id.toString(), 'assistant', response)
```

### 1d — ai-service: Expose Session API endpoints

**File**: `apps/server/ai-service/src/session/session.controller.ts`

```typescript
@Controller('api/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  @Get(':conversationId')
  async listSessions(
    @Param('conversationId') conversationId: string,
    @Req() req: any,
  ) {
    return this.aiSessionService.listSessions(req.user.sub, conversationId)
  }

  @Post(':conversationId/new')
  async createNewSession(
    @Param('conversationId') conversationId: string,
    @Req() req: any,
  ) {
    return this.aiSessionService.createNewSession(req.user.sub, conversationId)
  }

  @Post(':conversationId/resume/:sessionId')
  async resumeSession(
    @Param('conversationId') conversationId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: any,
  ) {
    return this.aiSessionService.resumeSession(sessionId, req.user.sub, conversationId)
  }

  @Patch(':sessionId/rename')
  async renameSession(
    @Param('sessionId') sessionId: string,
    @Body('name') name: string,
    @Req() req: any,
  ) {
    return this.aiSessionService.renameSession(sessionId, req.user.sub, name)
  }
}
```

---

## Phase 2 — Session list UI

### 2a — Web: Session panel trong ConversationSettingsDrawer

**File**: `apps/web/components/chat/ConversationSettingsDrawer.tsx`

Trong phần settings của AI conversation, thêm section "Lịch sử cuộc trò chuyện":

```tsx
{isAI && (
  <AiSessionPanel conversationId={conversation.id} />
)}
```

**File mới**: `apps/web/components/chat/AiSessionPanel.tsx`

```tsx
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCcw, Pencil } from 'lucide-react'
import { aiSessionApi } from '@/lib/api/ai-session'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'

interface AiSession {
  _id: string
  name: string
  isActive: boolean
  totalTokens: number
  summary: string | null
  createdAt: string
  updatedAt: string
}

export function AiSessionPanel({ conversationId }: { conversationId: string }) {
  const qc = useQueryClient()

  const { data: sessions = [] } = useQuery<AiSession[]>({
    queryKey: ['ai-sessions', conversationId],
    queryFn: () => aiSessionApi.listSessions(conversationId),
  })

  const newSession = useMutation({
    mutationFn: () => aiSessionApi.createNew(conversationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-sessions', conversationId] }),
  })

  const resumeSession = useMutation({
    mutationFn: (sessionId: string) => aiSessionApi.resume(conversationId, sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-sessions', conversationId] }),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Lịch sử cuộc trò chuyện</h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() => newSession.mutate()}
          disabled={newSession.isPending}
        >
          <Plus className="size-3" />
          Mới
        </Button>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {sessions.map((s) => (
          <div
            key={s._id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              s.isActive
                ? 'bg-primary/10 border border-primary/20'
                : 'hover:bg-muted/50 cursor-pointer'
            }`}
            onClick={() => !s.isActive && resumeSession.mutate(s._id)}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}
                {s.summary && ' · Đã tóm tắt'}
              </p>
            </div>
            {s.isActive && (
              <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                Active
              </span>
            )}
            {!s.isActive && (
              <RotateCcw className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 2b — Web: Chat input hint cho `/new` command

Trong chat input area, khi user gõ `/`, hiển thị suggestion:

```tsx
// Trong MessageInput hoặc ChatInputBar component:
{inputValue === '/' && (
  <div className="absolute bottom-full left-0 mb-1 bg-background border rounded-lg shadow-lg p-1 min-w-48">
    <button
      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded"
      onClick={() => {
        setInputValue('/new')
        handleSend('/new')
      }}
    >
      <Plus className="size-4 text-primary" />
      <div>
        <p className="font-medium">/new</p>
        <p className="text-xs text-muted-foreground">Bắt đầu cuộc trò chuyện mới</p>
      </div>
    </button>
  </div>
)}
```

### 2c — Mobile: Session list trong AI conversation

**File**: `apps/client/lib/features/chat/ui/widgets/ai_session_panel.dart` (tạo mới)

Tương tự web, nhưng render như một `ExpansionTile` trong drawer settings của AI conversation:

```dart
class AiSessionPanel extends ConsumerWidget {
  final String conversationId;
  const AiSessionPanel({required this.conversationId, super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(aiSessionsProvider(conversationId));

    return ExpansionTile(
      title: Text(context.l10n.aiSessionHistory),
      trailing: TextButton.icon(
        icon: const Icon(Icons.add, size: 16),
        label: Text(context.l10n.aiNewSession),
        onPressed: () => ref
            .read(aiSessionsProvider(conversationId).notifier)
            .createNew(),
      ),
      children: [
        sessionsAsync.when(
          data: (sessions) => ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: sessions.length,
            itemBuilder: (ctx, i) {
              final s = sessions[i];
              return ListTile(
                title: Text(s.name, style: const TextStyle(fontSize: 14)),
                subtitle: Text(
                  timeago.format(s.updatedAt),
                  style: const TextStyle(fontSize: 12),
                ),
                trailing: s.isActive
                    ? Chip(label: Text(context.l10n.active), padding: EdgeInsets.zero)
                    : IconButton(
                        icon: const Icon(Icons.restore, size: 18),
                        onPressed: () => ref
                            .read(aiSessionsProvider(conversationId).notifier)
                            .resume(s.id),
                      ),
                tileColor: s.isActive
                    ? Theme.of(ctx).colorScheme.primaryContainer.withOpacity(0.3)
                    : null,
              );
            },
          ),
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => const SizedBox.shrink(),
        ),
      ],
    );
  }
}
```

---

## Phase 3 — Auto-summarize (Compact) khi gần token limit

### 3a — ai-service: Thêm `CompactService`

**File**: `apps/server/ai-service/src/session/compact.service.ts`

```typescript
// Token threshold: compact khi history > 80K tokens (để có đủ room cho response)
const COMPACT_THRESHOLD_TOKENS = 80_000

@Injectable()
export class CompactService {
  constructor(
    private readonly claudeClient: ClaudeClientService,
    private readonly aiSessionService: AiSessionService,
  ) {}

  /**
   * Kiểm tra và compact session nếu cần.
   * Gọi này TRƯỚC khi gửi request tới Claude.
   */
  async maybeCompact(session: AiSessionDocument): Promise<AiSessionDocument> {
    if (session.totalTokens < COMPACT_THRESHOLD_TOKENS) {
      return session  // không cần compact
    }
    return this.compact(session)
  }

  private async compact(session: AiSessionDocument): Promise<AiSessionDocument> {
    const history = session.messages

    // Giữ lại 20% message gần nhất để không mất context tươi
    const keepCount = Math.ceil(history.length * 0.2)
    const toSummarize = history.slice(0, history.length - keepCount)
    const toKeep = history.slice(history.length - keepCount)

    // Gọi Claude Haiku để summarize (rẻ, nhanh)
    const summary = await this.claudeClient.summarize(
      toSummarize.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
    )

    // Prepend previous summary nếu đã có (layered summaries)
    const fullSummary = session.summary
      ? `${session.summary}\n\n[Later conversation summary]\n${summary}`
      : summary

    // Update session: thay messages cũ bằng summary, giữ messages mới
    await session.updateOne({
      $set: {
        messages: toKeep,
        summary: fullSummary,
        totalTokens: Math.ceil(session.totalTokens * 0.25),  // rough reset
      },
    })

    return (await session.model.findById(session._id))!
  }
}
```

Trong `ClaudeClientService`, thêm method:

```typescript
async summarize(conversationText: string): Promise<string> {
  const response = await this.anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',  // model rẻ nhất cho task này
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Summarize this conversation concisely, preserving key facts, decisions, and context that would be needed to continue the conversation:\n\n${conversationText}`,
    }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}
```

### 3b — Integrate compact vào main flow

Trong `handleAiRequest()`:

```typescript
let session = await this.aiSessionService.getOrCreateActiveSession(...)

// Compact trước khi gửi nếu cần
session = await this.compactService.maybeCompact(session)

const messageHistory = await this.aiSessionService.buildMessageHistory(session)
// ... tiếp tục như bình thường
```

### 3c — Notify user khi compact xảy ra

Khi compact được trigger, gửi 1 system message nhỏ vào chat:

```typescript
if (wasCompacted) {
  await this.publishSystemMessage(
    conversationId,
    '🗜️ Context đã được tóm tắt để tối ưu bộ nhớ. Lịch sử đầy đủ được lưu trong session.',
  )
}
```

---

## i18n keys cần thêm

**Web** (`messages/vi.json` và 6 file còn lại):
```json
"aiSessionHistory": "Lịch sử cuộc trò chuyện",
"aiNewSession": "Cuộc trò chuyện mới",
"aiSessionActive": "Đang hoạt động",
"aiNewSessionCreated": "Đã bắt đầu cuộc trò chuyện mới. Session cũ đã được lưu.",
"aiContextCompacted": "Context đã được tóm tắt để tối ưu bộ nhớ."
```

**Mobile** (ARB files — tương tự, với prefix `ai`):
```json
"aiSessionHistory": "Lịch sử cuộc trò chuyện",
"aiNewSession": "Cuộc trò chuyện mới",
"active": "Đang hoạt động"
```

---

## Lộ trình implement

```
Phase 1 (1-2 ngày):
├── packages/database: AiSession schema
├── ai-service: AiSessionService + SessionController
├── ai-service: Detect /new command
└── ai-service: Dùng session history thay vì payload.history

Phase 2 (2-3 ngày):
├── Web: AiSessionPanel component
├── Web: /new slash command suggestion trong input
├── Mobile: AiSessionPanel widget
└── Mobile: AiSessionsProvider (Riverpod)

Phase 3 (1-2 ngày, sau Phase 1+2 ổn định):
├── ai-service: CompactService
├── ai-service: ClaudeClient.summarize() với Haiku model
└── ai-service: Compact trigger + user notification
```

---

## Lưu ý kỹ thuật

- **Session vs Conversation**: 1 conversation (chat-service) có NHIỀU sessions (ai-service). Session là khái niệm của lớp AI, không phải chat.
- **`payload.history` hiện tại**: ai-service đang nhận `history[]` từ chat-service qua RabbitMQ. Sau khi có session, KHÔNG cần gửi `history` qua queue nữa — ai-service tự đọc từ MongoDB. Cần update chat-service để bỏ/empty `history` field khi publish.
- **Token counting**: Dùng rough estimate (chars/4) thay vì tiktoken để không phụ thuộc library bên ngoài. Đủ chính xác cho threshold trigger.
- **Session auto-naming**: Dùng Haiku, max 5-8 words, non-blocking (fire-and-forget). Nếu fail → giữ "New conversation".
- **Sliding window**: Nếu muốn thêm safety, có thể giới hạn `messages` tối đa 200 items trong `buildMessageHistory()` — nhưng KHÔNG PHẢI primary mechanism.
