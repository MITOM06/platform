package com.platform.chatservice.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.platform.chatservice.config.SecurityConfig;
import com.platform.chatservice.security.JwtAuthenticationFilter;
import com.platform.chatservice.security.JwtUtil;
import com.platform.chatservice.security.SessionValidator;
import com.platform.chatservice.service.rtc.LiveKitWebhookVerifier;
import com.platform.chatservice.service.rtc.RtcWebhookDispatcher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The webhook carries no user JWT, so it must get past the real security chain and be judged by the
 * controller's own signature check. A 401 with an empty body is the controller's; the entry point's
 * 401 carries a JSON body.
 */
@WebMvcTest(controllers = RtcWebhookController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
@TestPropertySource(properties = "app.cors.allowed-origins=https://app.example.com")
class RtcWebhookSecurityTest {

  @Autowired private MockMvc mvc;

  @MockBean private JwtUtil jwtUtil;
  @MockBean private SessionValidator sessionValidator;
  @MockBean private LiveKitWebhookVerifier verifier;
  @MockBean private RtcWebhookDispatcher dispatcher;

  @Test
  void webhookWithoutUserJwtReachesTheController() throws Exception {
    when(verifier.verify(anyString(), anyString())).thenReturn(true);

    mvc.perform(
            post("/api/rtc/livekit/webhook")
                .header("Authorization", "livekit-signed-token")
                .contentType("application/webhook+json")
                .content("{\"event\":\"room_finished\",\"room\":{\"name\":\"call_x\"}}"))
        .andExpect(status().isOk());
  }

  @Test
  void forgedWebhookIsRejectedByTheControllerNotTheEntryPoint() throws Exception {
    when(verifier.verify(any(), any())).thenReturn(false);
    when(verifier.verify(isNull(), any())).thenReturn(false);

    mvc.perform(post("/api/rtc/livekit/webhook").header("Authorization", "forged").content("{}"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().string(""));
  }
}
