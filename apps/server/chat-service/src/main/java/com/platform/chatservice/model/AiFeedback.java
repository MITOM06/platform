package com.platform.chatservice.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A single user's 👍/👎 feedback on an AI message. At most one document exists per (userId,
 * messageId) — enforced by the unique compound index. Clearing a vote ("none") deletes the doc.
 */
@Document(collection = "ai_feedback")
@CompoundIndex(name = "user_message_unique", def = "{'userId': 1, 'messageId': 1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiFeedback {

  @Id private String id;

  private String messageId;

  private String conversationId;

  private String userId;

  /** "up" | "down". A "none" rating deletes the document rather than persisting it. */
  private String rating;

  /** Optional free-text comment (typically only supplied for a "down" vote). */
  private String comment;

  @CreatedDate private Instant createdAt;

  @LastModifiedDate private Instant updatedAt;
}
