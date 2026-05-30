package com.platform.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Document(collection = "conversations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Conversation {

    /** Conversation kinds. Legacy docs without a type are treated as DIRECT. */
    public static final String TYPE_DIRECT = "direct";
    public static final String TYPE_GROUP = "group";

    @Id
    private String id;

    private List<String> participants;

    /** "direct" (1-1) or "group". Null on legacy docs => treated as direct. */
    private String type;

    /** Group display name (null for direct conversations). */
    private String name;

    /** Group avatar URL (null for direct conversations). */
    private String avatarUrl;

    /** User ids with admin rights (group only). */
    private List<String> admins;

    /** User id who created the conversation/group. */
    private String createdBy;

    /** Disappearing-messages window in seconds; null/0 = disabled. */
    private Integer autoDeleteSeconds;

    /** Per-user "clear history" / "delete chat" cutoff: messages at or before
     *  this instant are hidden for that user only. */
    private Map<String, Instant> clearedAt;

    /** Users who deleted/hid this conversation from their list. Re-added on a
     *  new incoming message. */
    private List<String> hiddenFor;

    private LastMessage lastMessage;

    private Instant lastMessageAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    /** Effective type, defaulting legacy docs to direct. */
    public String resolvedType() {
        return type == null ? TYPE_DIRECT : type;
    }

    public boolean isGroup() {
        return TYPE_GROUP.equals(type);
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LastMessage {
        private String content;
        private String senderId;
        private Instant createdAt;
    }
}
