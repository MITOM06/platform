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
 * Notes taken during a {@link Meeting}: one shared note per meeting plus one private note per
 * person. Used by the meeting notes endpoints (MT3).
 */
@Document(collection = "meeting_notes")
@CompoundIndex(
    name = "meeting_scope_owner",
    def = "{'meetingId': 1, 'scope': 1, 'ownerId': 1}",
    unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeetingNote {

  @Id private String id;

  private String meetingId;

  /** "SHARED" | "PRIVATE". */
  private String scope;

  /** Owner of a PRIVATE note; null for the SHARED note. */
  private String ownerId;

  private String content;

  /** Optimistic-concurrency version, bumped on every write. */
  private long version;

  private String updatedBy;

  private Instant updatedAt;
}
