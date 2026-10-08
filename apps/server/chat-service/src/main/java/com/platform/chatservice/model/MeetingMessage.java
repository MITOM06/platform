package com.platform.chatservice.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A chat line sent inside a {@link Meeting} room (MT3).
 *
 * <p>{@code meeting_sender_client} makes a send idempotent per {@code (meetingId, senderId,
 * clientId)}: a client retry with the same {@code clientId} can never store the line twice. It is
 * partial ({@code clientId} present), so lines sent without one are never constrained.
 */
@Document(collection = "meeting_messages")
@CompoundIndexes({
  @CompoundIndex(name = "meeting_created", def = "{'meetingId': 1, 'createdAt': 1}"),
  @CompoundIndex(
      name = "meeting_sender_client",
      def = "{'meetingId': 1, 'senderId': 1, 'clientId': 1}",
      unique = true,
      partialFilter = "{'clientId': {'$exists': true}}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeetingMessage {

  @Id private String id;

  private String meetingId;

  private String senderId;

  private String content;

  /**
   * The sender's optimistic-line id ({@code [A-Za-z0-9_-]{1,64}}) when the send carried a valid
   * one; absent otherwise (never written as null, so the partial unique index ignores the row).
   */
  private String clientId;

  private Instant createdAt;
}
