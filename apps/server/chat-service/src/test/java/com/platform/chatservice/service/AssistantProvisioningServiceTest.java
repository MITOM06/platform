package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AssistantProvisioningServiceTest {

  @Mock private BotFactoryClient botFactoryClient;
  @Mock private ConnectorServiceClient connectorClient;
  @Mock private ExternalBotAdminService externalBotAdminService;

  @InjectMocks private AssistantProvisioningService service;

  private static AssistantSetupRequest req() {
    return new AssistantSetupRequest("Aria", "You are my smart assistant", "prov-1");
  }

  private static ExternalBot existing() {
    return ExternalBot.builder()
        .id("eb-1")
        .botUserId("extbot:bf-1")
        .factoryBotId("bf-1")
        .ownerUserId("user-1")
        .name("Aria")
        .systemPrompt("Stored persona")
        .providerId("prov-1")
        .enabled(true)
        .build();
  }

  @BeforeEach
  void configured() {
    when(botFactoryClient.isConfigured()).thenReturn(true);
    when(connectorClient.isConfigured()).thenReturn(true);
    when(externalBotAdminService.findAssistantRecord("user-1")).thenReturn(Optional.empty());
  }

  @Test
  void provision_freshSetup_createsBotWiresMcpAndRegisters() {
    when(botFactoryClient.createBot("Aria", "You are my smart assistant")).thenReturn("bf-1");
    when(connectorClient.issueToken("user-1", "extbot:bf-1"))
        .thenReturn(new BotSessionResponse("tok-123", "https://connector/mcp"));

    AssistantSetupResponse res = service.provision("user-1", req());

    assertThat(res.botUserId()).isEqualTo("extbot:bf-1");
    assertThat(res.name()).isEqualTo("Aria");
    verify(botFactoryClient).updateBot("bf-1", "Aria", "You are my smart assistant", "prov-1");
    verify(botFactoryClient)
        .addMcpServer("bf-1", BotFactoryClient.PON_MCP_NAME, "https://connector/mcp", "tok-123");
    verify(externalBotAdminService)
        .registerAssistant("user-1", "bf-1", "Aria", null, "You are my smart assistant", "prov-1");
  }

  /** Unset CONNECTOR_SERVICE_BASE_URL / key used to fail AFTER creating a Bot Factory bot. */
  @Test
  void provision_whenBridgeNotConfigured_failsFastBeforeCreatingAnything() {
    when(connectorClient.isConfigured()).thenReturn(false);

    assertThatThrownBy(() -> service.provision("user-1", req()))
        .isInstanceOf(ApiException.class)
        .satisfies(
            e -> {
              assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
              assertThat(((ApiException) e).getCode())
                  .isEqualTo(ErrorCodes.ASSISTANT_NOT_CONFIGURED);
            });
    verify(botFactoryClient, never()).createBot(any(), any());
  }

  @Test
  void provision_whenTokenIssuanceFails_deletesTheJustCreatedBot_andReturnsTypedCode() {
    when(botFactoryClient.createBot(any(), any())).thenReturn("bf-1");
    when(connectorClient.issueToken("user-1", "extbot:bf-1"))
        .thenThrow(new IllegalStateException("connector down"));

    assertThatThrownBy(() -> service.provision("user-1", req()))
        .isInstanceOf(ApiException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.ASSISTANT_UPSTREAM_FAILED);
    verify(botFactoryClient).deleteBot("bf-1");
    verify(connectorClient, never()).revokeToken(any(), any());
    verify(externalBotAdminService, never())
        .registerAssistant(any(), any(), any(), any(), any(), any());
  }

  @Test
  void provision_whenMcpWiringFails_revokesTokenAndDeletesBot() {
    when(botFactoryClient.createBot(any(), any())).thenReturn("bf-1");
    when(connectorClient.issueToken("user-1", "extbot:bf-1"))
        .thenReturn(new BotSessionResponse("tok", "https://connector/mcp"));
    doThrow(new IllegalStateException("bf down"))
        .when(botFactoryClient)
        .addMcpServer(any(), any(), any(), any());

    assertThatThrownBy(() -> service.provision("user-1", req())).isInstanceOf(ApiException.class);
    verify(connectorClient).revokeToken("user-1", "extbot:bf-1");
    verify(botFactoryClient).deleteBot("bf-1");
  }

  @Test
  void provision_firstSetupWithoutPersona_isIncomplete() {
    assertThatThrownBy(
            () -> service.provision("user-1", new AssistantSetupRequest("Aria", " ", "prov-1")))
        .isInstanceOf(BadRequestException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.ASSISTANT_SETUP_INCOMPLETE);
    verifyNoInteractions(connectorClient);
  }

  @Test
  void provision_existing_updatesInsteadOfCreatingNewBot() {
    when(externalBotAdminService.findAssistantRecord("user-1")).thenReturn(Optional.of(existing()));

    AssistantSetupResponse res = service.provision("user-1", req());

    assertThat(res.botUserId()).isEqualTo("extbot:bf-1");
    verify(botFactoryClient, never()).createBot(any(), any());
    verify(connectorClient, never()).issueToken(any(), any());
    verify(botFactoryClient).updateBot("bf-1", "Aria", "You are my smart assistant", "prov-1");
  }

  /** A rename / model change without the persona keeps the stored persona (no 400, no wipe). */
  @Test
  void update_withoutPersona_keepsTheStoredOne() {
    when(externalBotAdminService.findAssistantRecord("user-1")).thenReturn(Optional.of(existing()));

    service.update("user-1", new AssistantSetupRequest("Max", null, "prov-2"));

    verify(botFactoryClient).updateBot("bf-1", "Max", null, "prov-2");
    verify(externalBotAdminService)
        .registerAssistant(eq("user-1"), eq("bf-1"), eq("Max"), any(), eq(null), eq("prov-2"));
  }

  @Test
  void getMine_returnsPersonaAndModel() {
    when(externalBotAdminService.findAssistantRecord("user-1")).thenReturn(Optional.of(existing()));

    AssistantInfoResponse me = service.getMine("user-1").orElseThrow();

    assertThat(me.systemPrompt()).isEqualTo("Stored persona");
    assertThat(me.providerId()).isEqualTo("prov-1");
    verify(botFactoryClient, never()).getBot(any());
  }

  @Test
  void getMine_legacyRegistration_fillsPersonaFromBotFactory() {
    ExternalBot legacy = existing().toBuilder().systemPrompt(null).providerId(null).build();
    when(externalBotAdminService.findAssistantRecord("user-1")).thenReturn(Optional.of(legacy));
    when(botFactoryClient.getBot("bf-1"))
        .thenReturn(new BotFactoryBotResponse("bf-1", "Aria", "Remote persona", "prov-9"));

    AssistantInfoResponse me = service.getMine("user-1").orElseThrow();

    assertThat(me.systemPrompt()).isEqualTo("Remote persona");
    assertThat(me.providerId()).isEqualTo("prov-9");
    verify(externalBotAdminService).updatePersona(legacy, "Remote persona", "prov-9");
  }

  @Test
  void tearDown_revokesTokenDeletesBotAndUnregisters() {
    when(externalBotAdminService.findAssistantFor("user-1"))
        .thenReturn(
            Optional.of(
                new ExternalBotResponse(
                    "eb-1", "extbot:bf-1", "bf-1", "user-1", "Aria", null, true)));

    service.tearDown("user-1");

    verify(connectorClient).revokeToken("user-1", "extbot:bf-1");
    verify(botFactoryClient).deleteBot("bf-1");
    verify(externalBotAdminService).unregister("user-1");
  }

  @Test
  void listProviders_delegatesToBotFactory_orReports503WhenUnconfigured() {
    List<BotFactoryProviderResponse> providers =
        List.of(new BotFactoryProviderResponse("prov-1", "Claude", "anthropic", "claude-opus-4-8"));
    when(botFactoryClient.listProviders()).thenReturn(providers);

    assertThat(service.listProviders()).isEqualTo(providers);

    when(botFactoryClient.isConfigured()).thenReturn(false);
    assertThatThrownBy(() -> service.listProviders())
        .isInstanceOf(ApiException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.ASSISTANT_NOT_CONFIGURED);
  }
}
