package com.platform.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One block relationship in the {@code user_blocks} collection (owned by auth-service).
 * chat-service reads it to decide whether a message between two users must be rejected (Block User
 * feature). This replaces the previous read-only view of {@code users.blockedUsers}; lookups are
 * now single indexed existence checks instead of loading a whole user document.
 */
@Document(collection = "user_blocks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBlock {

  @Id private String id;

  private String blockerId;

  private String blockedId;
}
