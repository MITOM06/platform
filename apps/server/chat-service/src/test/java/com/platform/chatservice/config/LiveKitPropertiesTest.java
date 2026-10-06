package com.platform.chatservice.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class LiveKitPropertiesTest {

  private static LiveKitProperties configured() {
    LiveKitProperties p = new LiveKitProperties();
    p.setUrl("wss://rtc.example.com");
    p.setApiKey("APIkey1");
    p.setApiSecret("0123456789abcdef0123456789abcdef");
    return p;
  }

  @Test
  void blankUrlKeyOrSecretMeansNotConfigured() {
    LiveKitProperties p = configured();
    assertThat(p.isConfigured()).isTrue();
    p.setApiKey(" ");
    assertThat(p.isConfigured()).isFalse();
  }

  @Test
  void callsUseSfuOnlyWhenAskedAndConfigured() {
    LiveKitProperties p = configured();
    assertThat(p.callsUseSfu()).isFalse(); // default "mesh"
    p.setCallTransport("SFU");
    assertThat(p.callsUseSfu()).isTrue();
    p.setUrl("");
    assertThat(p.callsUseSfu()).isFalse();
  }

  @Test
  void apiUrlIsDerivedFromTheClientUrlUnlessSet() {
    LiveKitProperties p = configured();
    assertThat(p.resolvedApiUrl()).isEqualTo("https://rtc.example.com");
    p.setUrl("ws://10.0.0.5:7880/");
    assertThat(p.resolvedApiUrl()).isEqualTo("http://10.0.0.5:7880");
    p.setApiUrl("http://livekit:7880/");
    assertThat(p.resolvedApiUrl()).isEqualTo("http://livekit:7880");
  }

  @Test
  void shortSecretIsRefused() {
    LiveKitProperties p = configured();
    p.setApiSecret("secret");
    assertThatThrownBy(p::signingKey)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("32");
  }
}
