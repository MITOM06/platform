package com.platform.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Read-only view of the {@code friendships} collection owned by auth-service. chat-service only
 * reads it to decide whether a new direct conversation between two users should start as a stranger
 * request (PENDING) or ACCEPTED.
 */
@Document(collection = "friendships")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Friendship {

  public static final String STATUS_ACCEPTED = "accepted";

  @Id private String id;

  private String requesterId;

  private String recipientId;

  private String status;
}
