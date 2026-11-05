package com.platform.chatservice.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One piece of raw material for AI meeting notes: a spoken line, a shared file or a shared screen
 * snapshot. {@code displayName} is null when the speaker could not be resolved — never the userId.
 */
@Document(collection = "meeting_records")
@CompoundIndex(name = "meeting_ts", def = "{'meetingId': 1, 'ts': 1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeetingRecord {

  public enum Kind {
    SPEECH,
    FILE,
    SCREEN
  }

  @Id private String id;

  private String meetingId;

  private Kind kind;

  private String userId;

  private String displayName;

  private String text;

  private Instant ts;

  /** Server time of insertion; {@code ts} is client-supplied (clamped) and may differ. */
  private Instant createdAt;
}
