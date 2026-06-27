package com.platform.chatservice.service;

import com.platform.chatservice.dto.AssistantInfoResponse;
import com.platform.chatservice.dto.AssistantSetupRequest;
import com.platform.chatservice.dto.AssistantSetupResponse;
import com.platform.chatservice.dto.BotFactoryProviderResponse;
import com.platform.chatservice.dto.BotSessionResponse;
import com.platform.chatservice.dto.ExternalBotResponse;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orchestrates the self-service "BotFather Zone" flow for a member's personal assistant: create the
 * Bot Factory bot, mint an MCP session token via connector-service, inject the MCP server into the
 * bot, and register the chat-service mapping — all wired automatically so the member never touches
 * Bot Factory directly. Also handles updates and best-effort tear-down.
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
  @Transactional
  public AssistantSetupResponse provision(String userId, AssistantSetupRequest req) {
    Optional<ExternalBotResponse> existing = externalBotAdminService.findAssistantFor(userId);
    if (existing.isPresent()) {
      update(userId, req);
      return new AssistantSetupResponse(existing.get().botUserId(), req.name());
    }

    String factoryBotId = botFactoryClient.createBot(req.name(), req.systemPrompt());
    botFactoryClient.updateBot(factoryBotId, req.name(), req.systemPrompt(), req.providerId());

    String botUserId = "extbot:" + factoryBotId;
    BotSessionResponse session = connectorClient.issueToken(userId, botUserId);
    botFactoryClient.addMcpServer(
        factoryBotId, BotFactoryClient.PON_MCP_NAME, session.mcpUrl(), session.token());

    externalBotAdminService.register(userId, factoryBotId, req.name(), null);
    return new AssistantSetupResponse(botUserId, req.name());
  }

  /** Update persona/model for the member's existing assistant. */
  public void update(String userId, AssistantSetupRequest req) {
    ExternalBotResponse existing =
        externalBotAdminService
            .findAssistantFor(userId)
            .orElseThrow(() -> new IllegalStateException("No assistant to update for " + userId));
    botFactoryClient.updateBot(
        existing.factoryBotId(), req.name(), req.systemPrompt(), req.providerId());
    externalBotAdminService.register(
        userId, existing.factoryBotId(), req.name(), existing.avatarUrl());
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

  /** The member's current assistant, or empty if they have not set one up yet. */
  public Optional<AssistantInfoResponse> getMine(String userId) {
    return externalBotAdminService
        .findAssistantFor(userId)
        .map(bot -> new AssistantInfoResponse(bot.botUserId(), bot.name(), bot.avatarUrl()));
  }

  /** AI providers a member can pick from (proxied from Bot Factory). */
  public List<BotFactoryProviderResponse> listProviders() {
    return botFactoryClient.listProviders();
  }
}
