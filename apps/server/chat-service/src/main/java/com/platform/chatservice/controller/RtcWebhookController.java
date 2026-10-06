package com.platform.chatservice.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.service.rtc.LiveKitWebhookEvent;
import com.platform.chatservice.service.rtc.LiveKitWebhookVerifier;
import com.platform.chatservice.service.rtc.RtcWebhookDispatcher;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Webhook from the LiveKit server. Not behind user JWT auth (SecurityConfig permits it): the
 * request authenticates itself with a token signed by the LiveKit API secret.
 */
@RestController
@RequestMapping("/api/rtc/livekit")
@RequiredArgsConstructor
public class RtcWebhookController {

  private final LiveKitWebhookVerifier verifier;
  private final RtcWebhookDispatcher dispatcher;
  private final ObjectMapper objectMapper;

  @PostMapping(value = "/webhook", consumes = MediaType.ALL_VALUE)
  public ResponseEntity<Void> receive(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestBody String body) {
    if (!verifier.verify(authorization, body)) {
      return ResponseEntity.status(401).build();
    }
    LiveKitWebhookEvent event;
    try {
      event = objectMapper.readValue(body, LiveKitWebhookEvent.class);
    } catch (JsonProcessingException e) {
      return ResponseEntity.badRequest().build();
    }
    dispatcher.dispatch(event);
    return ResponseEntity.ok().build();
  }
}
