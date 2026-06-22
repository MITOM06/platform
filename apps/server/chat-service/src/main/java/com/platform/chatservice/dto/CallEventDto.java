package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Per-conversation group-call lifecycle events broadcast to {@code
 * /topic/conversation/{conversationId}}.
 *
 * <p>Contract §3. Null fields are omitted from the wire payload by the default Jackson config used
 * elsewhere; events only populate the fields relevant to their {@code event} kind:
 *
 * <ul>
 *   <li>{@code call.started} → callId, conversationId, media, aiNotetaker, startedBy,
 *       startedByName, participants
 *   <li>{@code call.roster} → callId, participants
 *   <li>{@code call.ended} → callId
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CallEventDto {

  /** "call.started" | "call.roster" | "call.ended". */
  private String event;

  private String callId;

  private String conversationId;

  private String media;

  private Boolean aiNotetaker;

  private String startedBy;

  private String startedByName;

  private List<ParticipantDto> participants;

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class ParticipantDto {
    private String userId;
    private String displayName;
    private Instant joinedAt;
    private Instant leftAt;
  }
}
