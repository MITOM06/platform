package com.platform.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    private String id;

    private String conversationId;

    private String senderId;

    private String content;

    @Builder.Default
    private String type = "text"; // "text" | "image" | "video" | "system"

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
