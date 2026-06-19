package com.platform.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "token_usage")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenUsage {

  @Id private String id;

  private String userId;

  /** Date in YYYY-MM-DD format. */
  private String date;

  private int inputTokens;
  private int outputTokens;
  private int requestCount;
}
