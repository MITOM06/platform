package com.platform.chatservice.service;

import com.platform.chatservice.dto.AssistantInfoResponse;
import com.platform.chatservice.dto.AssistantSetupRequest;
import com.platform.chatservice.dto.AssistantSetupResponse;
import com.platform.chatservice.dto.BotFactoryBotResponse;
import com.platform.chatservice.dto.BotFactoryProviderResponse;
import com.platform.chatservice.dto.BotSessionResponse;
import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.ExternalBot;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Orchestrates the self-service "BotFather Zone" flow for a member's personal assistant: create the
 * Bot Factory bot, mint an MCP session token via connector-service, inject the MCP server into the
 * bot, and register the chat-service mapping — all wired automatically so the member never touches
 * Bot Factory directly. Also handles updates and best-effort tear-down.
 *
 * <p>Error contract: {@code 503 ASSISTANT_NOT_CONFIGURED} when the Bot Factory / connector-service
 * bridge is not configured (checked BEFORE anything is created); {@code 502
 * ASSISTANT_UPSTREAM_FAILED} when a Bot Factory / connector-service call fails — a bot created
 * during that setup is deleted again (and an issued token revoked), best effort, so retries no
 * longer pile up orphan bots; {@code 400 ASSISTANT_SETUP_INCOMPLETE} for a first setup without
 * persona/model.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AssistantProvisioningService {

  private final BotFactoryClient botFactoryClient;
  private final ConnectorServiceClient connectorClient;
  private final ExternalBotAdminService externalBotAdminService;

  /**
   * Full setup flow for a member. Idempotent: if the member already has an assistant we update its
   * persona/model in place instead of creating a second bot.
   */
  public AssistantSetupResponse provision(String userId, AssistantSetupRequest req) {
    Optional<ExternalBot> existing = externalBotAdminService.findAssistantRecord(userId);
    if (existing.isPresent()) {
      String name = update(userId, req);
      return new AssistantSetupResponse(existing.get().getBotUserId(), name);
    }

    String name = req.name().trim();
    String systemPrompt = trimToNull(req.systemPrompt());
    String providerId = trimToNull(req.providerId());
    if (systemPrompt == null || providerId == null) {
      throw new BadRequestException(
          ErrorCodes.ASSISTANT_SETUP_INCOMPLETE,
          "A new assistant needs a systemPrompt and a providerId");
    }
    if (!botFactoryClient.isConfigured() || !connectorClient.isConfigured()) {
      throw notConfigured();
    }

    String factoryBotId;
    try {
      factoryBotId = botFactoryClient.createBot(name, systemPrompt);
    } catch (RuntimeException e) {
      throw upstreamFailed("create the assistant bot", e);
    }
    String botUserId = "extbot:" + factoryBotId;
    boolean tokenIssued = false;
    try {
      botFactoryClient.updateBot(factoryBotId, name, systemPrompt, providerId);
      BotSessionResponse session = connectorClient.issueToken(userId, botUserId);
      tokenIssued = true;
      botFactoryClient.addMcpServer(
          factoryBotId, BotFactoryClient.PON_MCP_NAME, session.mcpUrl(), session.token());
      externalBotAdminService.registerAssistant(
          userId, factoryBotId, name, null, systemPrompt, providerId);
    } catch (RuntimeException e) {
      compensate(userId, factoryBotId, botUserId, tokenIssued);
      throw upstreamFailed("wire the assistant", e);
    }
    return new AssistantSetupResponse(botUserId, name);
  }

  /**
   * Update persona/model of the member's existing assistant. A blank/absent {@code systemPrompt} or
   * {@code providerId} keeps the current value (Bot Factory's PATCH ignores omitted fields).
   *
   * @return the assistant's (possibly new) name
   */
  public String update(String userId, AssistantSetupRequest req) {
    ExternalBot existing =
        externalBotAdminService
            .findAssistantRecord(userId)
            .orElseThrow(() -> new IllegalStateException("No assistant to update for " + userId));
    if (!botFactoryClient.isConfigured()) {
      throw notConfigured();
    }
    String name = trimToNull(req.name()) != null ? req.name().trim() : existing.getName();
    String systemPrompt = trimToNull(req.systemPrompt());
    String providerId = trimToNull(req.providerId());
    try {
      botFactoryClient.updateBot(existing.getFactoryBotId(), name, systemPrompt, providerId);
    } catch (RuntimeException e) {
      throw upstreamFailed("update the assistant", e);
    }
    externalBotAdminService.registerAssistant(
        userId,
        existing.getFactoryBotId(),
        name,
        existing.getAvatarUrl(),
        systemPrompt,
        providerId);
    return name;
  }

  /** Undo a half-finished setup so a retry does not leave an orphan Bot Factory bot behind. */
  private void compensate(
      String userId, String factoryBotId, String botUserId, boolean tokenIssued) {
    if (tokenIssued) {
      try {
        connectorClient.revokeToken(userId, botUserId);
      } catch (RuntimeException e) {
        log.warn("Setup rollback: failed to revoke MCP token of {}: {}", botUserId, e.toString());
      }
    }
    try {
      botFactoryClient.deleteBot(factoryBotId);
      log.info("Setup rollback: deleted Bot Factory bot {} for {}", factoryBotId, userId);
    } catch (RuntimeException e) {
      log.error(
          "Setup rollback: could not delete Bot Factory bot {} (orphan, delete manually): {}",
          factoryBotId,
          e.toString());
    }
  }

  /**
   * Tear down the member's assistant: revoke the MCP token, delete the Bot Factory bot, and drop
   * the chat-service mapping. Best-effort — a failure in one step does not block the others, so a
   * member can always reset even if Bot Factory or connector-service is partially unavailable.
   */
  public void tearDown(String userId) {
    Optional<ExternalBotResponse> existing = externalBotAdminService.findAssistantFor(userId);
    if (existing.isEmpty()) {
      return;
    }
    ExternalBotResponse bot = existing.get();

    try {
      connectorClient.revokeToken(userId, bot.botUserId());
    } catch (RuntimeException e) {
      log.warn("Tear-down: failed to revoke MCP token for {}: {}", userId, e.getMessage());
    }
    try {
      botFactoryClient.deleteBot(bot.factoryBotId());
    } catch (RuntimeException e) {
      log.warn(
          "Tear-down: failed to delete Bot Factory bot {}: {}", bot.factoryBotId(), e.getMessage());
    }
    try {
      externalBotAdminService.unregister(userId);
    } catch (RuntimeException e) {
      log.warn("Tear-down: failed to unregister mapping for {}: {}", userId, e.getMessage());
    }
  }

  /**
   * The member's current assistant, or empty if they have not set one up yet. Persona and model
   * come from the local mirror; a legacy registration without one is filled from Bot Factory (best
   * effort) and back-filled.
   */
  public Optional<AssistantInfoResponse> getMine(String userId) {
    return externalBotAdminService.findAssistantRecord(userId).map(this::toInfo);
  }

  private AssistantInfoResponse toInfo(ExternalBot bot) {
    String systemPrompt = bot.getSystemPrompt();
    String providerId = bot.getProviderId();
    if ((systemPrompt == null || providerId == null) && botFactoryClient.isConfigured()) {
      try {
        BotFactoryBotResponse remote = botFactoryClient.getBot(bot.getFactoryBotId());
        if (remote != null) {
          systemPrompt = systemPrompt != null ? systemPrompt : remote.systemPrompt();
          providerId = providerId != null ? providerId : remote.defaultProviderId();
          externalBotAdminService.updatePersona(bot, systemPrompt, providerId);
        }
      } catch (RuntimeException e) {
        log.debug(
            "Could not fetch persona of {} from Bot Factory: {}", bot.getBotUserId(), e.toString());
      }
    }
    return new AssistantInfoResponse(
        bot.getBotUserId(), bot.getName(), bot.getAvatarUrl(), systemPrompt, providerId);
  }

  /** AI providers a member can pick from (proxied from Bot Factory). */
  public List<BotFactoryProviderResponse> listProviders() {
    if (!botFactoryClient.isConfigured()) {
      throw notConfigured();
    }
    try {
      return botFactoryClient.listProviders();
    } catch (RuntimeException e) {
      throw upstreamFailed("list AI providers", e);
    }
  }

  private static ApiException notConfigured() {
    return new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCodes.ASSISTANT_NOT_CONFIGURED,
        "The personal-assistant bridge is not configured on this server");
  }

  private static ApiException upstreamFailed(String action, RuntimeException cause) {
    return new ApiException(
        HttpStatus.BAD_GATEWAY,
        ErrorCodes.ASSISTANT_UPSTREAM_FAILED,
        "Could not " + action + " (Bot Factory / connector-service call failed)",
        cause);
  }

  private static String trimToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
