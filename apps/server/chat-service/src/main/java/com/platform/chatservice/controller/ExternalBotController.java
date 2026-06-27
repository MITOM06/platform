package com.platform.chatservice.controller;

import com.platform.chatservice.dto.CreateExternalBotRequest;
import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.service.ExternalBotAdminService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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

  // NOTE: GET /api/assistant/me is served by AssistantSetupController#me() (the canonical
  // BotFather Zone endpoint), which delegates to the same ExternalBotAdminService#findAssistantFor
  // and returns the identical shape. The duplicate handler that used to live here caused an
  // ambiguous Spring MVC mapping (boot-crash on startup) and was removed.
}
