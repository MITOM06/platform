package com.platform.chatservice.controller;

import com.platform.chatservice.dto.LinkPreviewResponse;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.LinkPreviewService;
import com.platform.chatservice.service.RateLimiterService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/utils")
@RequiredArgsConstructor
public class UtilsController {

  private final LinkPreviewService linkPreviewService;
  private final RateLimiterService rateLimiterService;

  /**
   * Open Graph unfurl for a URL — used to render rich link-preview cards. Per-user rate limited
   * (429) since every call is an outbound fetch; internal/private targets are never fetched (the
   * response is then the same minimal card as for an unreachable site).
   */
  @GetMapping("/link-preview")
  public LinkPreviewResponse linkPreview(@RequestParam("url") String url) {
    rateLimiterService.checkLinkPreviewRate(currentUserId());
    return linkPreviewService.fetch(url);
  }

  private String currentUserId() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof UserPrincipal principal) {
      return principal.getUserId();
    }
    throw new UnauthorizedException("User is not authenticated");
  }
}
