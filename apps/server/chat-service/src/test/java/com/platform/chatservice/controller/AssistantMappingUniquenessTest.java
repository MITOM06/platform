package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThatCode;

import com.platform.chatservice.service.AssistantProvisioningService;
import com.platform.chatservice.service.ExternalBotAdminService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * Regression test for the production boot-crash where {@code ExternalBotController#myAssistant()}
 * and {@code AssistantSetupController#me()} both mapped {@code GET /api/assistant/me}, producing an
 * "Ambiguous mapping" {@link IllegalStateException} that aborted Spring context startup (Cloud Run
 * revision failed to listen on PORT 8080).
 *
 * <p>Standalone MockMvc builds a real {@code RequestMappingHandlerMapping}, so registering both
 * controllers together throws on any duplicate route — exactly the failure the full application
 * context hit on deploy. Building successfully proves the routes are unique again.
 */
@ExtendWith(MockitoExtension.class)
class AssistantMappingUniquenessTest {

  @Mock private AssistantProvisioningService provisioning;
  @Mock private ExternalBotAdminService externalBotAdminService;

  @Test
  void assistantControllersHaveNoAmbiguousMapping() {
    assertThatCode(
            () ->
                MockMvcBuilders.standaloneSetup(
                        new AssistantSetupController(provisioning),
                        new ExternalBotController(externalBotAdminService))
                    .build())
        .doesNotThrowAnyException();
  }
}
