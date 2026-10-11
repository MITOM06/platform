package com.platform.chatservice.service;

import com.platform.chatservice.dto.BotSessionResponse;
import com.platform.chatservice.model.ExternalBot;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Keeps members' Bot Factory assistants connected to PON: the MCP token injected at setup expires
 * after BOT_SESSION_TTL_DAYS (90 by default) and used to be issued once only, so every assistant
 * lost its tools three months after setup. This sweep re-issues each token {@link #RENEW_BEFORE}
 * ahead of its expiry and swaps it into the bot's {@code pon_connector} MCP server.
 *
 * <p>Safe on many instances (per-bot claim). A failed renewal keeps the old expiry, so the next
 * sweep retries it.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AssistantTokenRenewal {

  static final Duration RENEW_BEFORE = Duration.ofDays(14);

  /** Recorded when connector-service does not say when a token expires (older deployments). */
  static final Duration ASSUMED_TTL = Duration.ofDays(30);

  private final BotFactoryClient botFactoryClient;
  private final ConnectorServiceClient connectorClient;
  private final AssistantTokenStore store;

  @Scheduled(
      initialDelayString = "${app.assistant.token-renew-initial-delay-ms:300000}",
      fixedDelayString = "${app.assistant.token-renew-interval-ms:21600000}")
  public void sweep() {
    try {
      renewDue(Instant.now());
    } catch (Exception e) {
      log.warn("Assistant MCP token renewal sweep failed: {}", e.getMessage());
    }
  }

  void renewDue(Instant now) {
    if (!botFactoryClient.isConfigured() || !connectorClient.isConfigured()) {
      return;
    }
    for (ExternalBot bot : store.dueForRenewal(now, RENEW_BEFORE)) {
      if (!store.claim(bot.getId(), now)) {
        continue; // another instance is renewing it
      }
      try {
        renew(bot, now);
      } catch (RuntimeException e) {
        log.error(
            "Could not renew the MCP token of assistant {} (retried next sweep): {}",
            bot.getBotUserId(),
            e.toString());
      }
    }
  }

  private void renew(ExternalBot bot, Instant now) {
    BotSessionResponse session =
        connectorClient.issueToken(bot.getOwnerUserId(), bot.getBotUserId());
    // Issuing replaced the old token: swap the new one into the bot right away.
    botFactoryClient.removePonMcpServer(bot.getFactoryBotId());
    botFactoryClient.addMcpServer(
        bot.getFactoryBotId(), BotFactoryClient.PON_MCP_NAME, session.mcpUrl(), session.token());
    Instant expiresAt = session.expiresAt() != null ? session.expiresAt() : now.plus(ASSUMED_TTL);
    store.recordIssued(bot.getBotUserId(), expiresAt);
    log.info("Renewed the MCP token of assistant {} until {}", bot.getBotUserId(), expiresAt);
  }
}
