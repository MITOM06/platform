package com.platform.chatservice.dto;

import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebRTCSignalDto {
  private String senderId;
  private String targetId;
  private String conversationId;
  private String type; // "offer" | "answer" | "ice" | "end" | "call-ring"
  private String sdp;
  private Map<String, Object> candidate;
  private Integer duration;

  // ---- Group-call (mesh) optional fields. Null/absent for legacy 1-on-1 signaling. ----

  /** Group-call session id (UUID generated on call.start). */
  private String callId;

  /** Mesh signaling: the originator's userId, filled by the server on relay. */
  private String fromId;

  /** Ring payload: 'audio' | 'video'. */
  private String media;

  /** Ring payload: whether the AI notetaker is enabled for this call. */
  private Boolean aiNotetaker;

  /** Ring payload: display name of the member who started the call. */
  private String startedByName;
}
