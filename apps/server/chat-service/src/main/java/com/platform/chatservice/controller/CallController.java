package com.platform.chatservice.controller;

import com.platform.chatservice.dto.CallTranscriptDto;
import com.platform.chatservice.dto.WebRTCSignalDto;
import com.platform.chatservice.service.CallService;
import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

/**
 * STOMP endpoints for group calls (P2P mesh + AI notetaker). Controllers only parse the principal +
 * payload and delegate to {@link CallService}.
 *
 * <p>Contract §2. The signaling routes ({@code /app/call.offer|answer|ice}) are shared with the
 * legacy 1-on-1 flow and therefore live in {@link ChatController}, which branches on the presence
 * of {@code callId}: when set, it delegates to {@link CallService#relaySignal} (group mesh,
 * stamping {@code fromId}); otherwise it keeps the original 1-on-1 relay. This controller owns the
 * group-only lifecycle routes that have no legacy equivalent.
 */
@Controller
@RequiredArgsConstructor
public class CallController {

  private final CallService callService;

  @MessageMapping("/call.start")
  public void start(@Payload WebRTCSignalDto dto, Principal principal) {
    callService.startCall(
        principal.getName(),
        dto.getConversationId(),
        dto.getMedia(),
        Boolean.TRUE.equals(dto.getAiNotetaker()));
  }

  @MessageMapping("/call.join")
  public void join(@Payload WebRTCSignalDto dto, Principal principal) {
    callService.joinCall(principal.getName(), dto.getCallId());
  }

  @MessageMapping("/call.leave")
  public void leave(@Payload WebRTCSignalDto dto, Principal principal) {
    callService.leaveCall(principal.getName(), dto.getCallId());
  }

  @MessageMapping("/call.transcript")
  public void transcript(@Payload CallTranscriptDto dto, Principal principal) {
    callService.appendTranscript(principal.getName(), dto.getCallId(), dto.getText(), dto.getTs());
  }
}
