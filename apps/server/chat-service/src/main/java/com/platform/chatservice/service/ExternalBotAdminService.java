package com.platform.chatservice.service;

import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Registers member→Bot Factory bot mappings and resolves a member's personal assistant. */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExternalBotAdminService {

  private final ExternalBotRepository repo;

  /**
   * Create or update the mapping for {@code factoryBotId}. The synthetic chat identity is derived
   * deterministically as {@code "extbot:" + factoryBotId} so re-registering is idempotent.
   */
  public ExternalBotResponse register(
      String ownerUserId, String factoryBotId, String name, String avatarUrl) {
    return toResponse(save(ownerUserId, factoryBotId, name, avatarUrl, null, null));
  }

  /**
   * {@link #register} for the BotFather Zone flow, also mirroring the persona and model. A null
   * {@code systemPrompt} / {@code providerId} keeps the stored value.
   */
  public ExternalBotResponse registerAssistant(
      String ownerUserId,
      String factoryBotId,
      String name,
      String avatarUrl,
      String systemPrompt,
      String providerId) {
    return toResponse(save(ownerUserId, factoryBotId, name, avatarUrl, systemPrompt, providerId));
  }

  private ExternalBot save(
      String ownerUserId,
      String factoryBotId,
      String name,
      String avatarUrl,
      String systemPrompt,
      String providerId) {
    String botUserId = "extbot:" + factoryBotId;
    ExternalBot bot =
        repo.findByBotUserId(botUserId)
            .orElseGet(() -> ExternalBot.builder().botUserId(botUserId).build());
    bot.setOwnerUserId(ownerUserId);
    bot.setFactoryBotId(factoryBotId);
    bot.setName(name);
    bot.setAvatarUrl(avatarUrl);
    if (systemPrompt != null) {
      bot.setSystemPrompt(systemPrompt);
    }
    if (providerId != null) {
      bot.setProviderId(providerId);
    }
    bot.setEnabled(true);
    return repo.save(bot);
  }

  public Optional<ExternalBotResponse> findAssistantFor(String ownerUserId) {
    return findAssistantRecord(ownerUserId).map(this::toResponse);
  }

  /**
   * The member's assistant mapping (the newest enabled one). Duplicates should not exist, but a
   * duplicate used to make every call throw {@code IncorrectResultSizeDataAccessException}.
   */
  Optional<ExternalBot> findAssistantRecord(String ownerUserId) {
    List<ExternalBot> bots = repo.findByOwnerUserIdAndEnabledTrueOrderByCreatedAtDesc(ownerUserId);
    if (bots.size() > 1) {
      log.warn(
          "Member {} has {} enabled assistant mappings; using the newest ({})",
          ownerUserId,
          bots.size(),
          bots.get(0).getBotUserId());
    }
    return bots.stream().findFirst();
  }

  /**
   * Back-fill the mirrored persona/model of a legacy registration (null keeps the stored value).
   */
  void updatePersona(ExternalBot bot, String systemPrompt, String providerId) {
    boolean changed = false;
    if (systemPrompt != null && !systemPrompt.equals(bot.getSystemPrompt())) {
      bot.setSystemPrompt(systemPrompt);
      changed = true;
    }
    if (providerId != null && !providerId.equals(bot.getProviderId())) {
      bot.setProviderId(providerId);
      changed = true;
    }
    if (changed) {
      repo.save(bot);
    }
  }

  /** Workspace-wide list of all registered external bots, for the admin UI. */
  public List<ExternalBotResponse> listAll() {
    return repo.findAll().stream().map(this::toResponse).toList();
  }

  /** Remove the member's assistant mapping entirely (BotFather Zone tear-down). */
  public void unregister(String ownerUserId) {
    repo.deleteByOwnerUserId(ownerUserId);
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
