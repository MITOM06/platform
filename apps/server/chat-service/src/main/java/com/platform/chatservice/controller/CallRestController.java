package com.platform.chatservice.controller;

import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.service.SfuCallService;
import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** REST side of calls on LiveKit: which media path to use, and a room token to join. */
@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
public class CallRestController {

  private final SfuCallService sfuCalls;
  private final LiveKitProperties liveKit;

  @GetMapping("/config")
  public Map<String, Object> config() {
    Map<String, Object> body = new LinkedHashMap<>();
    boolean sfu = liveKit.callsUseSfu();
    body.put("transport", sfu ? "sfu" : "mesh");
    if (sfu) {
      body.put("livekitUrl", liveKit.getUrl());
    }
    return body;
  }

  @PostMapping("/{callId}/token")
  public SfuCallService.CallToken token(@PathVariable String callId, Principal principal) {
    return sfuCalls.issueToken(principal.getName(), callId);
  }
}
