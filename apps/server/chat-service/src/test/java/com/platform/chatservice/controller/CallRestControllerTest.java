package com.platform.chatservice.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.GlobalExceptionHandler;
import com.platform.chatservice.service.SfuCallService;
import java.security.Principal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CallRestControllerTest {

  @Mock private SfuCallService sfuCalls;
  private LiveKitProperties props;
  private MockMvc mvc;
  private final Principal alice = () -> "alice";

  @BeforeEach
  void setUp() {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret("0123456789abcdef0123456789abcdef");
    mvc =
        MockMvcBuilders.standaloneSetup(new CallRestController(sfuCalls, props))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void configOnMeshHasNoLiveKitUrl() throws Exception {
    mvc.perform(get("/api/calls/config").principal(alice))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.transport").value("mesh"))
        .andExpect(jsonPath("$.livekitUrl").doesNotExist());
  }

  @Test
  void configOnSfuCarriesTheLiveKitUrl() throws Exception {
    props.setCallTransport("sfu");
    mvc.perform(get("/api/calls/config").principal(alice))
        .andExpect(jsonPath("$.transport").value("sfu"))
        .andExpect(jsonPath("$.livekitUrl").value("wss://rtc.example.com"));
  }

  @Test
  void tokenIsReturned() throws Exception {
    when(sfuCalls.issueToken("alice", "c1"))
        .thenReturn(new SfuCallService.CallToken("wss://rtc.example.com", "jwt"));
    mvc.perform(post("/api/calls/c1/token").principal(alice))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.url").value("wss://rtc.example.com"))
        .andExpect(jsonPath("$.token").value("jwt"));
  }

  @Test
  void errorsCarryACodeAndNoInternalMessage() throws Exception {
    when(sfuCalls.issueToken("alice", "c1"))
        .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "CALL_FORBIDDEN"));
    mvc.perform(post("/api/calls/c1/token").principal(alice))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error").value("Forbidden"))
        .andExpect(jsonPath("$.code").value("CALL_FORBIDDEN"))
        .andExpect(jsonPath("$.statusCode").value(403))
        .andExpect(jsonPath("$.message").doesNotExist());
  }
}
