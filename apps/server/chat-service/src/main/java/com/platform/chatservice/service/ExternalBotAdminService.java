package com.platform.chatservice.service;

import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Registers member→Bot Factory bot mappings and resolves a member's personal assistant. */
@Service
@RequiredArgsConstructor
public class ExternalBotAdminService {

  private final ExternalBotRepository repo;

  /**
   * Create or update the mapping for {@code factoryBotId}. The synthetic chat identity is derived
   * deterministically as {@code "extbot:" + factoryBotId} so re-registering is idempotent.
   */
  public ExternalBotResponse register(
      String ownerUserId, String factoryBotId, String name, String avatarUrl) {
    String botUserId = "extbot:" + factoryBotId;
    ExternalBot bot =
        repo.findByBotUserId(botUserId)
            .orElseGet(() -> ExternalBot.builder().botUserId(botUserId).build());
    bot.setOwnerUserId(ownerUserId);
    bot.setFactoryBotId(factoryBotId);
    bot.setName(name);
    bot.setAvatarUrl(avatarUrl);
    bot.setEnabled(true);
    return toResponse(repo.save(bot));
  }

  public Optional<ExternalBotResponse> findAssistantFor(String ownerUserId) {
    return repo.findByOwnerUserIdAndEnabledTrue(ownerUserId).map(this::toResponse);
  }

  private ExternalBotResponse toResponse(ExternalBot b) {
    return new ExternalBotResponse(
        b.getId(),
        b.getBotUserId(),
        b.getFactoryBotId(),
        b.getOwnerUserId(),
        b.getName(),
        b.getAvatarUrl(),
        b.isEnabled());
  }
}
