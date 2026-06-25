package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.AssistantSetupRequest;
import com.platform.chatservice.dto.AssistantSetupResponse;
import com.platform.chatservice.dto.BotFactoryProviderResponse;
import com.platform.chatservice.dto.BotSessionResponse;
import com.platform.chatservice.dto.ExternalBotResponse;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

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

  private static ExternalBotResponse existing() {
    return new ExternalBotResponse("eb-1", "extbot:bf-1", "bf-1", "user-1", "Aria", null, true);
  }

  @Test
  void provision_freshSetup_createsBotWiresMcpAndRegisters() {
    when(externalBotAdminService.findAssistantFor("user-1")).thenReturn(Optional.empty());
    when(botFactoryClient.createBot("Aria", "You are my smart assistant")).thenReturn("bf-1");
    when(connectorClient.issueToken("user-1", "extbot:bf-1"))
        .thenReturn(new BotSessionResponse("tok-123", "https://connector/mcp"));

    AssistantSetupResponse res = service.provision("user-1", req());

    assertThat(res.botUserId()).isEqualTo("extbot:bf-1");
    assertThat(res.name()).isEqualTo("Aria");
    verify(botFactoryClient).createBot("Aria", "You are my smart assistant");
    verify(botFactoryClient).updateBot("bf-1", "Aria", "You are my smart assistant", "prov-1");
    verify(connectorClient).issueToken("user-1", "extbot:bf-1");
    verify(botFactoryClient)
        .addMcpServer("bf-1", BotFactoryClient.PON_MCP_NAME, "https://connector/mcp", "tok-123");
    verify(externalBotAdminService).register("user-1", "bf-1", "Aria", null);
  }

  @Test
  void provision_existing_updatesInsteadOfCreatingNewBot() {
    when(externalBotAdminService.findAssistantFor("user-1")).thenReturn(Optional.of(existing()));

    AssistantSetupResponse res = service.provision("user-1", req());

    assertThat(res.botUserId()).isEqualTo("extbot:bf-1");
    verify(botFactoryClient, never()).createBot(any(), any());
    verify(connectorClient, never()).issueToken(any(), any());
    verify(botFactoryClient).updateBot("bf-1", "Aria", "You are my smart assistant", "prov-1");
    verify(externalBotAdminService).register(eq("user-1"), eq("bf-1"), eq("Aria"), any());
  }

  @Test
  void update_existing_updatesPersonaAndModel() {
    when(externalBotAdminService.findAssistantFor("user-1")).thenReturn(Optional.of(existing()));

    service.update("user-1", new AssistantSetupRequest("Max", "New persona", "prov-2"));

    verify(botFactoryClient).updateBot("bf-1", "Max", "New persona", "prov-2");
    verify(externalBotAdminService).register(eq("user-1"), eq("bf-1"), eq("Max"), any());
  }

  @Test
  void tearDown_revokesTokenDeletesBotAndUnregisters() {
    when(externalBotAdminService.findAssistantFor("user-1")).thenReturn(Optional.of(existing()));

    service.tearDown("user-1");

    verify(connectorClient).revokeToken("user-1", "extbot:bf-1");
    verify(botFactoryClient).deleteBot("bf-1");
    verify(externalBotAdminService).unregister("user-1");
  }

  @Test
  void tearDown_noAssistant_isNoop() {
    when(externalBotAdminService.findAssistantFor("user-1")).thenReturn(Optional.empty());

    service.tearDown("user-1");

    verify(connectorClient, never()).revokeToken(any(), any());
    verify(botFactoryClient, never()).deleteBot(any());
    verify(externalBotAdminService, never()).unregister(any());
  }

  @Test
  void tearDown_continuesCleanupWhenAStepFails() {
    when(externalBotAdminService.findAssistantFor("user-1")).thenReturn(Optional.of(existing()));
    doThrow(new IllegalStateException("connector down"))
        .when(connectorClient)
        .revokeToken("user-1", "extbot:bf-1");

    service.tearDown("user-1");

    // Even though revoke failed, bot deletion and mapping cleanup still run.
    verify(botFactoryClient).deleteBot("bf-1");
    verify(externalBotAdminService).unregister("user-1");
  }

  @Test
  void listProviders_delegatesToBotFactory() {
    List<BotFactoryProviderResponse> providers =
        List.of(new BotFactoryProviderResponse("prov-1", "Claude", "anthropic", "claude-opus-4-8"));
    when(botFactoryClient.listProviders()).thenReturn(providers);

    assertThat(service.listProviders()).isEqualTo(providers);
  }
}
