package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.BotSessionResponse;
import com.platform.chatservice.model.ExternalBot;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AssistantTokenRenewalTest {

  @Mock private BotFactoryClient botFactoryClient;
  @Mock private ConnectorServiceClient connectorClient;
  @Mock private AssistantTokenStore store;
  @InjectMocks private AssistantTokenRenewal renewal;

  private static final Instant NOW = Instant.parse("2026-10-11T00:00:00Z");
  private static final Instant NEW_EXPIRY = NOW.plus(Duration.ofDays(90));
  private final ExternalBot bot =
      ExternalBot.builder()
          .id("row-1")
          .botUserId("extbot:fb-1")
          .factoryBotId("fb-1")
          .ownerUserId("u1")
          .build();

  @BeforeEach
  void setUp() {
    when(botFactoryClient.isConfigured()).thenReturn(true);
    when(connectorClient.isConfigured()).thenReturn(true);
    when(store.dueForRenewal(any(), any())).thenReturn(List.of(bot));
    when(store.claim(eq("row-1"), any())).thenReturn(true);
    when(connectorClient.issueToken("u1", "extbot:fb-1"))
        .thenReturn(new BotSessionResponse("new-tok", "https://connector/mcp", NEW_EXPIRY));
  }

  @Test
  void reissuesTheTokenSwapsTheBotsMcpServerAndRecordsTheNewExpiry() {
    renewal.renewDue(NOW);

    InOrder order = inOrder(connectorClient, botFactoryClient, store);
    order.verify(connectorClient).issueToken("u1", "extbot:fb-1");
    order.verify(botFactoryClient).removePonMcpServer("fb-1");
    order
        .verify(botFactoryClient)
        .addMcpServer("fb-1", BotFactoryClient.PON_MCP_NAME, "https://connector/mcp", "new-tok");
    order.verify(store).recordIssued("extbot:fb-1", NEW_EXPIRY);
  }

  @Test
  void aBotClaimedByAnotherInstanceIsSkipped() {
    when(store.claim(eq("row-1"), any())).thenReturn(false);

    renewal.renewDue(NOW);

    verify(connectorClient, never()).issueToken(anyString(), anyString());
  }

  @Test
  void aFailedRewireKeepsTheOldExpirySoTheNextSweepRetries() {
    doThrow(new IllegalStateException("bot factory down"))
        .when(botFactoryClient)
        .addMcpServer(anyString(), anyString(), anyString(), anyString());

    renewal.renewDue(NOW);

    verify(store, never()).recordIssued(anyString(), any());
  }

  @Test
  void oneFailingBotDoesNotStopTheOthers() {
    ExternalBot other =
        bot.toBuilder()
            .id("row-2")
            .botUserId("extbot:fb-2")
            .factoryBotId("fb-2")
            .ownerUserId("u2")
            .build();
    when(store.dueForRenewal(any(), any())).thenReturn(List.of(bot, other));
    when(store.claim(eq("row-2"), any())).thenReturn(true);
    when(connectorClient.issueToken("u1", "extbot:fb-1"))
        .thenThrow(new IllegalStateException("connector down"));
    when(connectorClient.issueToken("u2", "extbot:fb-2"))
        .thenReturn(new BotSessionResponse("t2", "https://connector/mcp", NEW_EXPIRY));

    renewal.renewDue(NOW);

    verify(store).recordIssued("extbot:fb-2", NEW_EXPIRY);
  }

  @Test
  void doesNothingWhenTheBridgeIsNotConfigured() {
    when(connectorClient.isConfigured()).thenReturn(false);

    renewal.renewDue(NOW);

    verify(store, never()).dueForRenewal(any(), any());
  }

  @Test
  void anIssuedTokenWithoutExpiryIsRecordedWithAConservativeOne() {
    when(connectorClient.issueToken("u1", "extbot:fb-1"))
        .thenReturn(new BotSessionResponse("new-tok", "https://connector/mcp", null));

    renewal.renewDue(NOW);

    verify(store).recordIssued("extbot:fb-1", NOW.plus(AssistantTokenRenewal.ASSUMED_TTL));
    assertThat(AssistantTokenRenewal.ASSUMED_TTL).isGreaterThan(AssistantTokenRenewal.RENEW_BEFORE);
  }
}
