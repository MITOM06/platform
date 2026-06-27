package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AssistantInfoResponse;
import com.platform.chatservice.dto.AssistantSetupRequest;
import com.platform.chatservice.dto.AssistantSetupResponse;
import com.platform.chatservice.dto.BotFactoryProviderResponse;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AssistantProvisioningService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Self-service "BotFather Zone" API: any authenticated member can create, update, or tear down
 * their own personal assistant. Intentionally <em>not</em> gated by {@code PERM_MANAGE_WORKSPACE} —
 * every action is scoped to the caller's own {@code userId} from the security context, never a
 * request param.
 */
@RestController
@RequestMapping("/api/assistant")
@RequiredArgsConstructor
public class AssistantSetupController {

  private final AssistantProvisioningService provisioning;

  /** The caller's personal assistant, or 404 if they have not set one up yet. */
  @GetMapping("/me")
  public ResponseEntity<AssistantInfoResponse> me() {
    return provisioning
        .getMine(currentUserId())
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  /** Create the member's assistant (or update it in place if one already exists). */
  @PostMapping("/setup")
  public AssistantSetupResponse setup(@Valid @RequestBody AssistantSetupRequest req) {
    return provisioning.provision(currentUserId(), req);
  }

  /** Tear down the member's assistant entirely. */
  @DeleteMapping("/setup")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void tearDown() {
    provisioning.tearDown(currentUserId());
  }

  /** AI providers the member can pick a model from (proxied from Bot Factory). */
  @GetMapping("/providers")
  public List<BotFactoryProviderResponse> providers() {
    return provisioning.listProviders();
  }

  private String currentUserId() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof UserPrincipal principal) {
      return principal.getUserId();
    }
    throw new UnauthorizedException("User is not authenticated");
  }
}
