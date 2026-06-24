package com.platform.chatservice.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Registry entry mapping a PON member ({@code ownerUserId}) to their personal Bot Factory bot
 * ({@code factoryBotId}). {@code botUserId} is the synthetic participant/sender id used inside chat
 * (e.g. {@code "extbot:<factoryBotId>"}) — it sits in {@code Conversation.participants} and is the
 * {@code senderId} on the bot's messages, exactly like the built-in AI bot id.
 */
@Document(collection = "external_bots")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExternalBot {

  @Id private String id;

  @Indexed(unique = true)
  private String botUserId;

  private String factoryBotId;

  @Indexed private String ownerUserId;

  private String name;

  private String avatarUrl;

  @Builder.Default private boolean enabled = true;

  @CreatedDate private Instant createdAt;
}
