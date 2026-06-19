package com.platform.chatservice.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "reminders")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Reminder {

  @Id private String id;

  private String userId;

  private String conversationId;

  private String text;

  private Instant remindAt;

  @Builder.Default private boolean done = false;

  @Builder.Default private Instant createdAt = Instant.now();
}
