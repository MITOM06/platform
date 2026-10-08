package com.platform.chatservice.service.rtc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.platform.chatservice.config.LiveKitProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LiveKitTokenServiceTest {

  private LiveKitProperties props;
  private LiveKitTokenService service;

  @BeforeEach
  void setUp() {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret("0123456789abcdef0123456789abcdef");
    service = new LiveKitTokenService(props);
  }

  private Claims parse(String token) {
    return Jwts.parserBuilder()
        .setSigningKey(props.signingKey())
        .build()
        .parseClaimsJws(token)
        .getBody();
  }

  @Test
  void participantTokenCarriesIdentityRoomAndDefaultGrants() {
    Claims c =
        parse(
            service.participantToken(
                "user-1", "Alice", "{\"avatarUrl\":\"/a.png\"}", RtcGrant.participant("call_abc")));

    assertThat(c.getIssuer()).isEqualTo("APIkey1");
    assertThat(c.getSubject()).isEqualTo("user-1");
    assertThat(c.get("name")).isEqualTo("Alice");
    assertThat(c.get("metadata")).isEqualTo("{\"avatarUrl\":\"/a.png\"}");
    Map<?, ?> video = c.get("video", Map.class);
    assertThat(video.get("room")).isEqualTo("call_abc");
    assertThat(video.get("roomJoin")).isEqualTo(true);
    assertThat(video.get("canPublish")).isEqualTo(true);
    assertThat(video.get("canSubscribe")).isEqualTo(true);
    assertThat(video.get("canPublishData")).isEqualTo(true);
    assertThat(video.containsKey("roomAdmin")).isFalse();
    assertThat(video.containsKey("canPublishSources")).isFalse();
    long ttl = (c.getExpiration().getTime() - c.getNotBefore().getTime()) / 1000;
    assertThat(ttl).isEqualTo(600);
  }

  @Test
  void sourcesAreEmittedOnlyWhenSetAndAParticipantIsNeverARoomAdmin() {
    RtcGrant grant =
        RtcGrant.participant("meet_1").withSources(List.of(RtcGrant.CAMERA, RtcGrant.MICROPHONE));
    Map<?, ?> video =
        parse(service.participantToken("u", null, null, grant)).get("video", Map.class);

    assertThat(video.get("canPublishSources")).isEqualTo(List.of("camera", "microphone"));
    assertThat(video.containsKey("roomAdmin")).isFalse();
  }

  @Test
  void blankNameAndMetadataAreLeftOut() {
    Claims c = parse(service.participantToken("u", " ", "", RtcGrant.participant("call_x")));
    assertThat(c.containsKey("name")).isFalse();
    assertThat(c.containsKey("metadata")).isFalse();
  }

  @Test
  void serverTokenGrantsRoomAdministrationForAMinute() {
    Claims c = parse(service.serverToken("meet_1"));
    Map<?, ?> video = c.get("video", Map.class);

    assertThat(video.get("room")).isEqualTo("meet_1");
    assertThat(video.get("roomAdmin")).isEqualTo(true);
    assertThat(video.get("roomCreate")).isEqualTo(true);
    assertThat(video.get("roomList")).isEqualTo(true);
    assertThat((c.getExpiration().getTime() - c.getNotBefore().getTime()) / 1000).isEqualTo(60);
  }

  @Test
  void blankIdentityIsRejected() {
    assertThatThrownBy(
            () -> service.participantToken(" ", "A", null, RtcGrant.participant("call_x")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void refusesWhenLiveKitIsNotConfigured() {
    props.setUrl("");
    assertThatThrownBy(
            () -> service.participantToken("u", "A", null, RtcGrant.participant("call_x")))
        .isInstanceOf(LiveKitUnavailableException.class);
    assertThatThrownBy(() -> service.serverToken(null))
        .isInstanceOf(LiveKitUnavailableException.class);
  }

  @Test
  void refusesAShortSecret() {
    props.setApiSecret("short-secret");
    assertThatThrownBy(
            () -> service.participantToken("u", "A", null, RtcGrant.participant("call_x")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("32");
  }
}
