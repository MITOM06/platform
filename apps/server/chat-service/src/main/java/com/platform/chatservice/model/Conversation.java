package com.platform.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document(collection = "conversations")
@CompoundIndexes({
    // Primary query: user's conversation list sorted by recency (most critical hot path)
    @CompoundIndex(name = "participants_last_msg", def = "{'participants': 1, 'lastMessageAt': -1}"),
    // Public channel discovery sorted by recency
    @CompoundIndex(name = "public_channel_last_msg", def = "{'publicChannel': 1, 'lastMessageAt': -1}"),
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Conversation {

    /** Conversation kinds. Legacy docs without a type are treated as DIRECT. */
    public static final String TYPE_DIRECT = "direct";
    public static final String TYPE_GROUP = "group";

    /** Stranger-request states. Legacy/group/friend chats are ACCEPTED. */
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_ACCEPTED = "accepted";

    @Id
    private String id;

    @Indexed
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

    /** Public group channels are discoverable and joinable by any authenticated user. */
    @Builder.Default
    private boolean publicChannel = false;

    /** Message ids pinned in this conversation (most recent first, max 5). */
    @Builder.Default
    private List<String> pinnedMessages = new ArrayList<>();

    /** "pending" (stranger request awaiting acceptance) or "accepted". Null on
     *  legacy docs => treated as accepted. */
    @Builder.Default
    private String status = STATUS_ACCEPTED;

    /** Disappearing-messages window in seconds; null/0 = disabled. */
    private Integer autoDeleteSeconds;

    /** Per-user "clear history" / "delete chat" cutoff: messages at or before
     *  this instant are hidden for that user only. */
    private Map<String, Instant> clearedAt;

    /** Users who deleted/hid this conversation from their list. Re-added on a
     *  new incoming message. */
    private List<String> hiddenFor;

    /** Users who muted this conversation. */
    @Builder.Default
    private List<String> mutedUsers = new ArrayList<>();

    /** Users who archived this conversation. */
    @Builder.Default
    private List<String> archivedBy = new ArrayList<>();

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

    /** Effective status, defaulting legacy docs to accepted. */
    public String resolvedStatus() {
        return status == null ? STATUS_ACCEPTED : status;
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
