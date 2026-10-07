package com.platform.chatservice.service.rtc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.LiveKitProperties;
import io.jsonwebtoken.Jwts;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class LiveKitRoomClientTest {

  private LiveKitProperties props;
  private HttpClient http;
  private HttpResponse<String> response;
  private LiveKitRoomClient client;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() throws Exception {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret("0123456789abcdef0123456789abcdef");
    http = mock(HttpClient.class);
    response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(200);
    when(response.body()).thenReturn("{}");
    doReturn(response).when(http).send(any(HttpRequest.class), any());
    client = new LiveKitRoomClient(props, new LiveKitTokenService(props), new ObjectMapper(), http);
  }

  private HttpRequest sentRequest() throws Exception {
    ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
    verify(http).send(captor.capture(), any());
    return captor.getValue();
  }

  private static String bodyOf(HttpRequest request) throws InterruptedException {
    StringBuilder out = new StringBuilder();
    CountDownLatch done = new CountDownLatch(1);
    request
        .bodyPublisher()
        .orElseThrow()
        .subscribe(
            new Flow.Subscriber<ByteBuffer>() {
              @Override
              public void onSubscribe(Flow.Subscription s) {
                s.request(Long.MAX_VALUE);
              }

              @Override
              public void onNext(ByteBuffer item) {
                out.append(StandardCharsets.UTF_8.decode(item));
              }

              @Override
              public void onError(Throwable t) {
                done.countDown();
              }

              @Override
              public void onComplete() {
                done.countDown();
              }
            });
    done.await(1, TimeUnit.SECONDS);
    return out.toString();
  }

  @Test
  void removeParticipantCallsTwirpWithARoomScopedServerToken() throws Exception {
    client.removeParticipant("meet_1", "user-1");

    HttpRequest request = sentRequest();
    assertThat(request.method()).isEqualTo("POST");
    assertThat(request.uri().toString())
        .isEqualTo("https://rtc.example.com/twirp/livekit.RoomService/RemoveParticipant");
    assertThat(request.headers().firstValue("Content-Type")).contains("application/json");
    String token = request.headers().firstValue("Authorization").orElseThrow();
    assertThat(token).startsWith("Bearer ");
    Map<?, ?> video =
        Jwts.parserBuilder()
            .setSigningKey(props.signingKey())
            .build()
            .parseClaimsJws(token.substring(7))
            .getBody()
            .get("video", Map.class);
    assertThat(video.get("room")).isEqualTo("meet_1");
    assertThat(new ObjectMapper().readValue(bodyOf(request), Map.class))
        .isEqualTo(Map.of("room", "meet_1", "identity", "user-1"));
  }

  @Test
  void mutePublishedTrackSendsTheTrackSid() throws Exception {
    client.mutePublishedTrack("meet_1", "user-1", "TR_1", true);

    HttpRequest request = sentRequest();
    assertThat(request.uri().getPath()).isEqualTo("/twirp/livekit.RoomService/MutePublishedTrack");
    assertThat(new ObjectMapper().readValue(bodyOf(request), Map.class))
        .isEqualTo(
            Map.of("room", "meet_1", "identity", "user-1", "track_sid", "TR_1", "muted", true));
  }

  @Test
  void createRoomSetsTheTimeoutsAndTheParticipantCap() throws Exception {
    client.createRoom("meet_1", 300, 300, 25);

    HttpRequest request = sentRequest();
    assertThat(request.uri().getPath()).isEqualTo("/twirp/livekit.RoomService/CreateRoom");
    assertThat(new ObjectMapper().readValue(bodyOf(request), Map.class))
        .isEqualTo(
            Map.of(
                "name", "meet_1",
                "empty_timeout", 300,
                "departure_timeout", 300,
                "max_participants", 25));
  }

  @Test
  void deleteRoomTargetsTheRoom() throws Exception {
    client.deleteRoom("call_c1");

    HttpRequest request = sentRequest();
    assertThat(request.uri().getPath()).isEqualTo("/twirp/livekit.RoomService/DeleteRoom");
    assertThat(new ObjectMapper().readValue(bodyOf(request), Map.class))
        .isEqualTo(Map.of("room", "call_c1"));
  }

  @Test
  void listParticipantsParsesTracksAndNormalisesSources() {
    when(response.body())
        .thenReturn(
            "{\"participants\":[{\"identity\":\"u1\",\"name\":\"Alice\",\"tracks\":["
                + "{\"sid\":\"TR_1\",\"source\":\"MICROPHONE\",\"muted\":false},"
                + "{\"sid\":\"TR_2\",\"source\":3,\"muted\":true}]},"
                + "{\"identity\":\"u2\"}]}");

    List<LiveKitRoomClient.RoomParticipant> participants = client.listParticipants("meet_1");

    assertThat(participants).hasSize(2);
    assertThat(participants.get(0).identity()).isEqualTo("u1");
    assertThat(participants.get(0).name()).isEqualTo("Alice");
    assertThat(participants.get(0).tracks())
        .containsExactly(
            new LiveKitRoomClient.RoomTrack("TR_1", "MICROPHONE", false),
            new LiveKitRoomClient.RoomTrack("TR_2", "SCREEN_SHARE", true));
    assertThat(participants.get(1).tracks()).isEmpty();
  }

  @Test
  void errorStatusBecomesAnApiException() {
    when(response.statusCode()).thenReturn(404);
    when(response.body()).thenReturn("{\"code\":\"not_found\",\"msg\":\"room not found\"}");

    assertThatThrownBy(() -> client.deleteRoom("call_gone"))
        .isInstanceOf(LiveKitApiException.class)
        .satisfies(
            e -> {
              LiveKitApiException api = (LiveKitApiException) e;
              assertThat(api.method()).isEqualTo("DeleteRoom");
              assertThat(api.status()).isEqualTo(404);
            });
  }

  @Test
  void networkFailureBecomesAnApiException() throws Exception {
    doThrow(new IOException("connection refused")).when(http).send(any(HttpRequest.class), any());

    assertThatThrownBy(() -> client.removeParticipant("meet_1", "u1"))
        .isInstanceOf(LiveKitApiException.class)
        .satisfies(e -> assertThat(((LiveKitApiException) e).status()).isEqualTo(-1));
  }

  @Test
  void refusesWhenLiveKitIsOff() {
    props.setUrl("");
    assertThatThrownBy(() -> client.deleteRoom("call_c1"))
        .isInstanceOf(LiveKitUnavailableException.class);
  }

  @Test
  void updateParticipantReplacesThePublishPermission() throws Exception {
    client.updateParticipant("meet_1", "user-1", List.of(RtcGrant.CAMERA, RtcGrant.MICROPHONE));

    HttpRequest request = sentRequest();
    assertThat(request.uri().getPath()).isEqualTo("/twirp/livekit.RoomService/UpdateParticipant");
    assertThat(new ObjectMapper().readValue(bodyOf(request), Map.class))
        .isEqualTo(
            Map.of(
                "room", "meet_1",
                "identity", "user-1",
                "permission",
                    Map.of(
                        "can_publish", true,
                        "can_subscribe", true,
                        "can_publish_data", true,
                        "can_publish_sources", List.of("CAMERA", "MICROPHONE"))));
  }

  @Test
  void updateParticipantWithoutASourceListAllowsEverySource() throws Exception {
    client.updateParticipant("meet_1", "user-1", null);

    Map<?, ?> body = new ObjectMapper().readValue(bodyOf(sentRequest()), Map.class);
    assertThat(((Map<?, ?>) body.get("permission")).get("can_publish_sources"))
        .isEqualTo(List.of());
  }
}
