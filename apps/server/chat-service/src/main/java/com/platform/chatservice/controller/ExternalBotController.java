package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AssistantResponse;
import com.platform.chatservice.dto.CreateExternalBotRequest;
import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.ExternalBotAdminService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ExternalBotController {

  private final ExternalBotAdminService service;

  /** Register/update a member→Bot Factory bot mapping. Workspace admins only. */
  @PostMapping("/admin/external-bots")
  @PreAuthorize("hasAuthority('PERM_MANAGE_WORKSPACE')")
  @ResponseStatus(HttpStatus.CREATED)
  public ExternalBotResponse register(@Valid @RequestBody CreateExternalBotRequest req) {
    return service.register(req.ownerUserId(), req.factoryBotId(), req.name(), req.avatarUrl());
  }

  /** List all registered external bots in the workspace. Workspace admins only. */
  @GetMapping("/admin/external-bots")
  @PreAuthorize("hasAuthority('PERM_MANAGE_WORKSPACE')")
  public List<ExternalBotResponse> list() {
    return service.listAll();
  }

  /** The calling member's personal assistant identity, or 404 if none is registered. */
  @GetMapping("/assistant/me")
  public ResponseEntity<AssistantResponse> myAssistant() {
    String uid = currentUserId();
    return service
        .findAssistantFor(uid)
        .map(b -> ResponseEntity.ok(new AssistantResponse(b.botUserId(), b.name(), b.avatarUrl())))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  private String currentUserId() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof UserPrincipal principal) {
      return principal.getUserId();
    }
    throw new UnauthorizedException("User is not authenticated");
  }
}
