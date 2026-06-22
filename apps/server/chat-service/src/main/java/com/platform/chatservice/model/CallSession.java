package com.platform.chatservice.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A group-call (mesh) session. chat-service is the writer/owner; ai-service reads the same
 * collection via its own Mongoose model for the AI-notetaker summary flow.
 *
 * <p>Contract: {@code docs/superpowers/specs/2026-06-22-track-a-group-call-contracts.md} §1.
 */
@Document(collection = "call_sessions")
@CompoundIndexes({
  // Lookup by conversation, most recent first (active-call / history queries).
  @CompoundIndex(name = "conv_started", def = "{'conversationId': 1, 'startedAt': -1}"),
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CallSession {

  @Id private String id;

  /** UUID generated on call.start. */
  @Indexed(unique = true)
  private String callId;

  private String conversationId;

  /** userId of the member who started the call. */
  private String startedBy;

  private String startedByName;

  private Instant startedAt;

  /** Set when the call ends (last participant left or explicit end). Null while active. */
  private Instant endedAt;

  /** 'audio' | 'video'. */
  private String media;

  /** Whether the AI notetaker (transcript → summary) is enabled. */
  @Builder.Default private boolean aiNotetaker = false;

  @Builder.Default private List<Participant> participants = new ArrayList<>();

  /** Id of the persisted {@code meeting_summary} Message, once produced. Null otherwise. */
  private String summaryMessageId;

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Participant {
    private String userId;
    private String displayName;
    private Instant joinedAt;

    /** Null while the participant is still in the call. */
    private Instant leftAt;
  }
}
