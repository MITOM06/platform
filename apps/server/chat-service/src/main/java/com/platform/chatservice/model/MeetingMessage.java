package com.platform.chatservice.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/** A chat line sent inside a {@link Meeting} room (MT3). */
@Document(collection = "meeting_messages")
@CompoundIndex(name = "meeting_created", def = "{'meetingId': 1, 'createdAt': 1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeetingMessage {

  @Id private String id;

  private String meetingId;

  private String senderId;

  private String content;

  private Instant createdAt;
}
