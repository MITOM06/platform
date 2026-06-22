package com.platform.chatservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Client → server transcript segment for {@code /app/call.transcript}. The server fills
 * userId/displayName from the authenticated principal; the client only sends the recognized text
 * and a client timestamp.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CallTranscriptDto {
  private String callId;
  private String text;

  /** Client epoch-millis timestamp of the final STT result. */
  private Long ts;
}
