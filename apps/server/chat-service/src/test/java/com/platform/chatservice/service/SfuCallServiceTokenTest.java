package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.repository.CallSessionRepository;
import com.platform.chatservice.repository.UserBlockRepository;
import com.platform.chatservice.service.rtc.LiveKitTokenService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SfuCallServiceTokenTest {

  private static final String ALICE = "64b000000000000000000001";
  private static final String BOB = "64b000000000000000000002";

  @Mock private CallService calls;
  @Mock private CallBusyRegistry busy;
  @Mock private CallSessionRepository sessions;
  @Mock private UserBlockRepository blocks;
  @Mock private MongoTemplate mongo;
  private LiveKitProperties props;
  private SfuCallService service;
  private CallSession session;

  @BeforeEach
  void setUp() {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret("0123456789abcdef0123456789abcdef");
    service = new SfuCallService(calls, busy, props, new LiveKitTokenService(props), blocks, mongo);
    session =
        CallSession.builder()
            .callId("c1")
            .conversationId("conv")
            .startedBy(ALICE)
            .transport("sfu")
            .kind("direct")
            .participants(new ArrayList<>())
            .build();
    when(calls.findSession("c1")).thenReturn(Optional.of(session));
    when(calls.membersOf("conv")).thenReturn(List.of(ALICE, BOB));
    when(mongo.findOne(any(Query.class), eq(Document.class), eq("users")))
        .thenReturn(new Document("displayName", "Alice").append("avatarUrl", "/a.png"));
  }

  private static HttpStatus statusOf(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e.status();
    }
    throw new AssertionError("expected ApiException");
  }

  @Test
  void memberGetsARoomTokenWithTheirNameAndAvatar() {
    SfuCallService.CallToken t = service.issueToken(ALICE, "c1");

    assertThat(t.url()).isEqualTo("wss://rtc.example.com");
    Claims c =
        Jwts.parserBuilder()
            .setSigningKey(props.signingKey())
            .build()
            .parseClaimsJws(t.token())
            .getBody();
    assertThat(c.getSubject()).isEqualTo(ALICE);
    assertThat(c.get("name")).isEqualTo("Alice");
    assertThat(c.get("metadata")).isEqualTo("{\"avatarUrl\":\"/a.png\"}");
    assertThat(((Map<?, ?>) c.get("video", Map.class)).get("room")).isEqualTo("call_c1");
  }

  @Test
  void unknownUserNameIsLeftOutNotReplacedByTheId() {
    when(mongo.findOne(any(Query.class), eq(Document.class), eq("users"))).thenReturn(null);
    Claims c =
        Jwts.parserBuilder()
            .setSigningKey(props.signingKey())
            .build()
            .parseClaimsJws(service.issueToken(ALICE, "c1").token())
            .getBody();
    assertThat(c.containsKey("name")).isFalse();
  }

  @Test
  void errorsMapToTheContractCodes() {
    assertThatThrownBy(() -> service.issueToken("stranger", "c1"))
        .isInstanceOf(ApiException.class)
        .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("CALL_FORBIDDEN"));
    assertThat(statusOf(() -> service.issueToken("stranger", "c1")))
        .isEqualTo(HttpStatus.FORBIDDEN);

    when(blocks.existsByBlockerIdAndBlockedId(BOB, ALICE)).thenReturn(true);
    assertThat(statusOf(() -> service.issueToken(ALICE, "c1"))).isEqualTo(HttpStatus.FORBIDDEN);
    when(blocks.existsByBlockerIdAndBlockedId(BOB, ALICE)).thenReturn(false);

    session.setTransport("mesh");
    assertThat(statusOf(() -> service.issueToken(ALICE, "c1"))).isEqualTo(HttpStatus.CONFLICT);
    session.setTransport("sfu");

    session.setEndedAt(Instant.now());
    assertThat(statusOf(() -> service.issueToken(ALICE, "c1"))).isEqualTo(HttpStatus.CONFLICT);

    when(calls.findSession("gone")).thenReturn(Optional.empty());
    assertThat(statusOf(() -> service.issueToken(ALICE, "gone"))).isEqualTo(HttpStatus.NOT_FOUND);

    props.setUrl("");
    assertThat(statusOf(() -> service.issueToken(ALICE, "c1")))
        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
  }
}
