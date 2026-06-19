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
  private String type; // "offer" | "answer" | "ice" | "end"
  private String sdp;
  private Map<String, Object> candidate;
  private Integer duration;
}
