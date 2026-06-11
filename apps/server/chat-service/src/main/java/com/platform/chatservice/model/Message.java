package com.platform.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "messages")
@CompoundIndexes({
    // Primary query: paginated history for a conversation (most critical hot path)
    @CompoundIndex(name = "conv_created", def = "{'conversationId': 1, 'createdAt': -1}"),
    // Attachment gallery: filter by type within a conversation
    @CompoundIndex(name = "conv_type_created", def = "{'conversationId': 1, 'type': 1, 'createdAt': -1}"),
    // Sender-scoped lookups: edit/recall own messages
    @CompoundIndex(name = "conv_sender", def = "{'conversationId': 1, 'senderId': 1}"),
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    private String id;

    private String conversationId;

    private String senderId;

    /** Text index powers conversation-scoped message search (Task 50). */
    @TextIndexed
    private String content;

    @Builder.Default
    private String type = "text"; // "text" | "image" | "video" | "file" | "voice" | "sticker" | "system" | "call_log" | "ai"

    @Builder.Default
    private List<String> readBy = new ArrayList<>();

    /** Id of the message this one replies to (null if not a reply). */
    private String replyToId;

    /** Denormalized snapshot of the replied-to message for quick rendering. */
    private ReplyPreview replyPreview;

    /** Emoji reactions on this message. */
    @Builder.Default
    private List<Reaction> reactions = new ArrayList<>();

    /** True when recalled (unsent) for everyone — content is cleared. */
    @Builder.Default
    private boolean recalled = false;

    /** Users who deleted this message only for themselves. */
    @Builder.Default
    private List<String> deletedFor = new ArrayList<>();

    /** Set when the sender edits the message content (null if never edited). */
    private Instant editedAt;

    /** User ids @-mentioned in this message (resolved from displayNames). */
    @Builder.Default
    private List<String> mentions = new ArrayList<>();

    /** Agent trace for AI messages — null for non-AI messages. */
    @org.springframework.data.mongodb.core.mapping.Field("trace")
    private AiTraceData trace;

    @CreatedDate
    private Instant createdAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Reaction {
        private String userId;
        private String emoji;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReplyPreview {
        private String messageId;
        private String senderId;
        private String content;
    }
}
