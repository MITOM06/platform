# RTC Foundation (LiveKit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chat-service có một lớp `rtc` dùng chung (cấp token LiveKit, nhận webhook đã xác thực, gọi room API) và repo có cấu hình triển khai LiveKit cho self-host và cho một máy media riêng — nền cho cả Cuộc gọi lẫn Phòng họp.

**Architecture:** Gói mới `com.platform.chatservice.service.rtc` chứa toàn bộ phần nói chuyện với LiveKit; `CallService` và `MeetingService` (ở các plan sau) chỉ cài interface `RtcRoomEventHandler` và gọi `LiveKitTokenService` / `LiveKitRoomClient`. Token và webhook ký HS256 bằng jjwt 0.11.5 có sẵn, room API gọi Twirp JSON bằng `java.net.http.HttpClient` (cùng kiểu `LinkPreviewService`) — **không thêm dependency**. Plan này không đổi hành vi nào người dùng thấy được: `CALL_TRANSPORT` mặc định `mesh`.

**Tech Stack:** Spring Boot 3.3 (Java 21, JUnit 5, Mockito 5, AssertJ, Spotless) · jjwt 0.11.5 · LiveKit server v1.8 · Docker Compose · Caddy 2.

**Spec:** `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` (§3 D1/D5/D8/D10, §4.1, §8).

## Global Constraints

- Nhánh `feat/rtc-foundation` cắt từ `origin/main`. Task 9 (LiveKit cho dev local) làm **trên nhánh `dev`, commit riêng**, không bao giờ vào nhánh tính năng (`.claude/rules/dev-local-only.md`).
- Sau mỗi lần sửa Java: `mvn spotless:apply` (spotless bind vào test-compile). Maven chạy JDK 21: `export JAVA_HOME=$(/usr/libexec/java_home -v 21)` — JDK mặc định của Homebrew làm hỏng Lombok.
- Java ≤ 500 dòng/file (`.claude/rules/clean-code.md`).
- `LIVEKIT_API_SECRET` ≥ **32 ký tự** (LiveKit đòi điều này ngoài chế độ `--dev`, và `Keys.hmacShaKeyFor` của jjwt cũng vậy).
- Tên room: `call_{callId}`, `meet_{meetingId}` (spec D8).
- Token người tham gia sống **600 giây**; token server (room API) sống **60 giây**.
- Trần **25** người/room (owner chốt 2026-08-28) đặt ở cấu hình LiveKit `room.max_participants`.
- Mọi biến môi trường mới phải có trong file example tương ứng; `bash scripts/ci/check-env-parity.sh` phải xanh.
- Không có giá trị `localhost` / LAN trong file nào lên `main` (`scripts/ci/check-env-leaks.sh`).

## Review Focus

1. **Webhook giả mạo hoặc bị sửa body** — phải trả 401 và không gọi handler nào. Test ở Task 3 (body bị sửa, sai issuer, sai secret, hết hạn) và Task 4 (controller không dispatch khi verify fail).
2. **Webhook đúng nhưng chặn bởi Spring Security** (LiveKit không gửi JWT người dùng) — route phải `permitAll` và tự xác thực. Kiểm tra bằng curl ở Task 4 Step 6: 401 phải có **body rỗng** (của controller), không phải JSON `Full authentication is required` (của entry point).
3. **Handler của một domain ném lỗi** — webhook vẫn trả 200 (LiveKit coi non-2xx là lỗi giao hàng) và lỗi được log. Test ở Task 4 (`handlerFailureIsContained`).
4. **Secret ngắn hoặc thiếu cấu hình** — không cấp token "hỏng" mà ném lỗi rõ ràng; prod với `CALL_TRANSPORT=sfu` mà thiếu biến thì không khởi động. Test ở Task 2 và Task 6.
5. **Room API trả lỗi / timeout** — ném `LiveKitApiException` có tên method + status, không nuốt im lặng. Test ở Task 5.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `apps/server/chat-service/src/main/java/com/platform/chatservice/config/LiveKitProperties.java` (mới) | Bind `app.livekit.*`, `isConfigured()`, `callsUseSfu()`, `resolvedApiUrl()`, `signingKey()` |
| `.../service/rtc/RtcRooms.java` (mới) | Tiền tố và tách id khỏi tên room |
| `.../service/rtc/RtcGrant.java` (mới) | Quyền trong token, sinh claim `video` |
| `.../service/rtc/LiveKitUnavailableException.java` (mới) | LiveKit chưa cấu hình |
| `.../service/rtc/LiveKitApiException.java` (mới) | Room API trả lỗi |
| `.../service/rtc/LiveKitTokenService.java` (mới) | Ký token người tham gia và token server |
| `.../service/rtc/LiveKitWebhookEvent.java` (mới) | Payload webhook (chỉ field dùng tới) |
| `.../service/rtc/LiveKitWebhookVerifier.java` (mới) | Kiểm chữ ký + `sha256` |
| `.../service/rtc/RtcRoomEventHandler.java` (mới) | Interface domain cài để nhận sự kiện room |
| `.../service/rtc/RtcWebhookDispatcher.java` (mới) | Chuyển sự kiện tới handler theo tên room |
| `.../service/rtc/LiveKitRoomClient.java` (mới) | Twirp: `ListParticipants`, `MutePublishedTrack`, `RemoveParticipant`, `DeleteRoom` |
| `.../controller/RtcWebhookController.java` (mới) | `POST /api/rtc/livekit/webhook` |
| `.../config/SecurityConfig.java` (sửa) | permitAll cho route webhook |
| `.../config/ProdEnvironmentGuard.java` (sửa) | Kiểm biến LiveKit khi prod |
| `apps/server/chat-service/src/main/resources/application.yml` (sửa) | Khối `app.livekit` |
| `infra/docker-compose/compose.prod.yml`, `Caddyfile`, `.env.example`, `bootstrap.sh`, `bootstrap.test.sh` (sửa) | Self-host: LiveKit chạy cùng stack |
| `infra/livekit/compose.livekit.yml`, `infra/livekit/.env.livekit.example`, `infra/livekit/Caddyfile` (mới) | Máy media riêng (VPS) cho triển khai Mac mini |
| `infra/docker-compose/compose.mini.yml`, `.env.mini.example` (sửa) | chat-service trên mini trỏ tới máy media |
| `docs/superpowers/runbooks/livekit.md` (mới) | Dựng máy media, firewall, kiểm tra |
| `CLAUDE.md`, `docs/environments.md` (sửa) | Bảng port, biến môi trường |

Test nằm song song dưới `apps/server/chat-service/src/test/java/com/platform/chatservice/...`.

Lệnh test dùng chung cho Task 1–6 (thay `<Test>` bằng tên class):

```bash
cd apps/server/chat-service && export JAVA_HOME=$(/usr/libexec/java_home -v 21) && mvn -q spotless:apply && mvn -q test -Dtest=<Test>
```

---

### Task 1: Cấu hình LiveKit, tên room và quyền

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/config/LiveKitProperties.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/RtcRooms.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/RtcGrant.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitUnavailableException.java`
- Modify: `apps/server/chat-service/src/main/resources/application.yml` (khối `app:`, sau `botfactory:`)
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/config/LiveKitPropertiesTest.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/RtcRoomsTest.java`

**Interfaces:**
- Produces: `LiveKitProperties` (getter/setter Lombok `url`, `apiUrl`, `apiKey`, `apiSecret`, `callTransport`, `tokenTtlSeconds`; `boolean isConfigured()`, `boolean callsUseSfu()`, `String resolvedApiUrl()`, `SecretKey signingKey()`); `RtcRooms.forCall(String)`, `RtcRooms.forMeeting(String)`, `RtcRooms.idOf(String room, String prefix)`, hằng `CALL_PREFIX`, `MEETING_PREFIX`; record `RtcGrant(String room, boolean canPublish, boolean canSubscribe, boolean canPublishData, boolean roomAdmin, List<String> canPublishSources)` với `participant(String)`, `withSources(List<String>)`, `asRoomAdmin()`, `Map<String,Object> toVideoClaim()`, hằng `CAMERA`, `MICROPHONE`, `SCREEN_SHARE`, `SCREEN_SHARE_AUDIO`; `LiveKitUnavailableException`.

- [ ] **Step 1: Viết test thất bại**

`LiveKitPropertiesTest.java`:

```java
package com.platform.chatservice.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class LiveKitPropertiesTest {

  private static LiveKitProperties configured() {
    LiveKitProperties p = new LiveKitProperties();
    p.setUrl("wss://rtc.example.com");
    p.setApiKey("APIkey1");
    p.setApiSecret("0123456789abcdef0123456789abcdef"); // gitleaks:allow
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
```

`RtcRoomsTest.java`:

```java
package com.platform.chatservice.service.rtc;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RtcRoomsTest {

  @Test
  void roomNamesCarryTheirDomainPrefix() {
    assertThat(RtcRooms.forCall("abc")).isEqualTo("call_abc");
    assertThat(RtcRooms.forMeeting("m1")).isEqualTo("meet_m1");
  }

  @Test
  void idOfStripsOnlyTheMatchingPrefix() {
    assertThat(RtcRooms.idOf("call_abc", RtcRooms.CALL_PREFIX)).isEqualTo("abc");
    assertThat(RtcRooms.idOf("meet_m1", RtcRooms.CALL_PREFIX)).isNull();
    assertThat(RtcRooms.idOf("call_", RtcRooms.CALL_PREFIX)).isNull();
    assertThat(RtcRooms.idOf(null, RtcRooms.CALL_PREFIX)).isNull();
  }
}
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: lệnh test chung với `-Dtest='LiveKitPropertiesTest,RtcRoomsTest'`
Expected: FAIL — compile error, `LiveKitProperties` / `RtcRooms` chưa tồn tại.

- [ ] **Step 3: Viết code**

`LiveKitProperties.java`:

```java
package com.platform.chatservice.config;

import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Connection settings for the LiveKit media server that carries calls and meetings. Bound from
 * {@code app.livekit.*}. When url, key or secret is blank LiveKit is off: calls stay on the P2P
 * mesh path and meetings report themselves unavailable.
 *
 * <p>Spec: {@code docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md} §4.1.
 */
@Component
@ConfigurationProperties(prefix = "app.livekit")
@Data
public class LiveKitProperties {

  /** LiveKit refuses shorter secrets outside --dev, and jjwt refuses them for HS256. */
  static final int MIN_SECRET_LENGTH = 32;

  /** wss:// URL handed to clients. */
  private String url;

  /** http(s):// URL of the server API; blank = derived from {@link #url}. */
  private String apiUrl;

  private String apiKey;
  private String apiSecret;

  /** "mesh" (default) or "sfu": the media path for calls. Meetings always use LiveKit. */
  private String callTransport = "mesh";

  private long tokenTtlSeconds = 600;

  public boolean isConfigured() {
    return StringUtils.hasText(url)
        && StringUtils.hasText(apiKey)
        && StringUtils.hasText(apiSecret);
  }

  public boolean callsUseSfu() {
    return "sfu".equalsIgnoreCase(callTransport) && isConfigured();
  }

  public String resolvedApiUrl() {
    if (!isConfigured()) {
      throw new IllegalStateException("LiveKit is not configured");
    }
    String base =
        StringUtils.hasText(apiUrl)
            ? apiUrl
            : url.replaceFirst("^wss://", "https://").replaceFirst("^ws://", "http://");
    return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
  }

  public SecretKey signingKey() {
    if (!StringUtils.hasText(apiSecret) || apiSecret.length() < MIN_SECRET_LENGTH) {
      throw new IllegalStateException(
          "LIVEKIT_API_SECRET must be at least " + MIN_SECRET_LENGTH + " characters");
    }
    return Keys.hmacShaKeyFor(apiSecret.getBytes(StandardCharsets.UTF_8));
  }
}
```

`RtcRooms.java`:

```java
package com.platform.chatservice.service.rtc;

/**
 * LiveKit room names. The prefix tells the webhook which domain owns the room (spec D8), so a
 * room name is all it needs to route an event.
 */
public final class RtcRooms {

  public static final String CALL_PREFIX = "call_";
  public static final String MEETING_PREFIX = "meet_";

  private RtcRooms() {}

  public static String forCall(String callId) {
    return CALL_PREFIX + callId;
  }

  public static String forMeeting(String meetingId) {
    return MEETING_PREFIX + meetingId;
  }

  /** The id after {@code prefix}, or null when the room does not carry that prefix. */
  public static String idOf(String room, String prefix) {
    if (room == null || !room.startsWith(prefix) || room.length() == prefix.length()) {
      return null;
    }
    return room.substring(prefix.length());
  }
}
```

`RtcGrant.java`:

```java
package com.platform.chatservice.service.rtc;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** What a LiveKit access token lets its holder do in one room. */
public record RtcGrant(
    String room,
    boolean canPublish,
    boolean canSubscribe,
    boolean canPublishData,
    boolean roomAdmin,
    List<String> canPublishSources) {

  public static final String CAMERA = "camera";
  public static final String MICROPHONE = "microphone";
  public static final String SCREEN_SHARE = "screen_share";
  public static final String SCREEN_SHARE_AUDIO = "screen_share_audio";

  /** Publish, subscribe and send data in {@code room}; every source allowed. */
  public static RtcGrant participant(String room) {
    return new RtcGrant(room, true, true, true, false, null);
  }

  public RtcGrant withSources(List<String> sources) {
    return new RtcGrant(
        room, canPublish, canSubscribe, canPublishData, roomAdmin, List.copyOf(sources));
  }

  public RtcGrant asRoomAdmin() {
    return new RtcGrant(room, canPublish, canSubscribe, canPublishData, true, canPublishSources);
  }

  /** The {@code video} claim LiveKit reads. Optional grants are omitted rather than false. */
  Map<String, Object> toVideoClaim() {
    Map<String, Object> video = new LinkedHashMap<>();
    video.put("room", room);
    video.put("roomJoin", true);
    video.put("canPublish", canPublish);
    video.put("canSubscribe", canSubscribe);
    video.put("canPublishData", canPublishData);
    if (roomAdmin) {
      video.put("roomAdmin", true);
    }
    if (canPublishSources != null) {
      video.put("canPublishSources", canPublishSources);
    }
    return video;
  }
}
```

`LiveKitUnavailableException.java`:

```java
package com.platform.chatservice.service.rtc;

/** LiveKit is not configured on this deployment (url, key or secret blank). */
public class LiveKitUnavailableException extends RuntimeException {
  public LiveKitUnavailableException() {
    super("LiveKit is not configured");
  }
}
```

Trong `application.yml`, ngay sau khối `botfactory:` (cùng thụt lề với `botfactory:`):

```yaml
  livekit:
    # Media server for calls and meetings
    # (docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md).
    # Blank url/key/secret = LiveKit off: calls stay P2P, meetings are unavailable.
    url: ${LIVEKIT_URL:}
    api-url: ${LIVEKIT_API_URL:}
    api-key: ${LIVEKIT_API_KEY:}
    api-secret: ${LIVEKIT_API_SECRET:}
    # mesh (P2P, default) | sfu (through LiveKit). Rollback = set back to mesh.
    call-transport: ${CALL_TRANSPORT:mesh}
```

- [ ] **Step 4: Chạy lại, phải PASS**

Run: lệnh test chung với `-Dtest='LiveKitPropertiesTest,RtcRoomsTest'`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add apps/server/chat-service/src/main/java/com/platform/chatservice/config/LiveKitProperties.java \
  apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/ \
  apps/server/chat-service/src/main/resources/application.yml \
  apps/server/chat-service/src/test/java/com/platform/chatservice/config/LiveKitPropertiesTest.java \
  apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/RtcRoomsTest.java
git commit -m "feat(chat): LiveKit settings, room names and grants"
```

---

### Task 2: Ký token LiveKit

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitTokenService.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/LiveKitTokenServiceTest.java`

**Interfaces:**
- Consumes: `LiveKitProperties`, `RtcGrant`, `LiveKitUnavailableException` (Task 1).
- Produces: `String participantToken(String identity, String displayName, String metadataJson, RtcGrant grant)`; `String serverToken(String room)` (room có thể null).

- [ ] **Step 1: Viết test thất bại**

```java
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
    props.setApiSecret("0123456789abcdef0123456789abcdef"); // gitleaks:allow
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
  void sourcesAndAdminAreEmittedOnlyWhenSet() {
    RtcGrant grant =
        RtcGrant.participant("meet_1")
            .withSources(List.of(RtcGrant.CAMERA, RtcGrant.MICROPHONE))
            .asRoomAdmin();
    Map<?, ?> video = parse(service.participantToken("u", null, null, grant)).get("video", Map.class);

    assertThat(video.get("canPublishSources")).isEqualTo(List.of("camera", "microphone"));
    assertThat(video.get("roomAdmin")).isEqualTo(true);
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
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: lệnh test chung với `-Dtest=LiveKitTokenServiceTest`
Expected: FAIL — `LiveKitTokenService` chưa tồn tại.

- [ ] **Step 3: Viết code**

```java
package com.platform.chatservice.service.rtc;

import com.platform.chatservice.config.LiveKitProperties;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Signs LiveKit access tokens. Clients get a short-lived participant token for one room; the
 * room API gets an even shorter server token. Format: https://docs.livekit.io/home/get-started/authentication/
 */
@Service
@RequiredArgsConstructor
public class LiveKitTokenService {

  private static final long SERVER_TOKEN_TTL_SECONDS = 60;

  private final LiveKitProperties props;

  public String participantToken(
      String identity, String displayName, String metadataJson, RtcGrant grant) {
    requireConfigured();
    if (!StringUtils.hasText(identity)) {
      throw new IllegalArgumentException("identity is required");
    }
    JwtBuilder builder =
        base(props.getTokenTtlSeconds()).setSubject(identity).claim("video", grant.toVideoClaim());
    if (StringUtils.hasText(displayName)) {
      builder.claim("name", displayName);
    }
    if (StringUtils.hasText(metadataJson)) {
      builder.claim("metadata", metadataJson);
    }
    return builder.signWith(props.signingKey(), SignatureAlgorithm.HS256).compact();
  }

  /** Token for the server API (Twirp). {@code room} may be null for room-independent calls. */
  public String serverToken(String room) {
    requireConfigured();
    Map<String, Object> video = new LinkedHashMap<>();
    if (room != null) {
      video.put("room", room);
    }
    video.put("roomAdmin", true);
    video.put("roomCreate", true);
    video.put("roomList", true);
    return base(SERVER_TOKEN_TTL_SECONDS)
        .claim("video", video)
        .signWith(props.signingKey(), SignatureAlgorithm.HS256)
        .compact();
  }

  private JwtBuilder base(long ttlSeconds) {
    Instant now = Instant.now();
    return Jwts.builder()
        .setIssuer(props.getApiKey())
        .setId(UUID.randomUUID().toString())
        .setNotBefore(Date.from(now))
        .setExpiration(Date.from(now.plusSeconds(ttlSeconds)));
  }

  private void requireConfigured() {
    if (!props.isConfigured()) {
      throw new LiveKitUnavailableException();
    }
  }
}
```

- [ ] **Step 4: Chạy lại, phải PASS**

Run: lệnh test chung với `-Dtest=LiveKitTokenServiceTest`
Expected: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
git add apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitTokenService.java \
  apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/LiveKitTokenServiceTest.java
git commit -m "feat(chat): sign LiveKit participant and server tokens"
```

---

### Task 3: Xác thực webhook LiveKit

LiveKit gửi `POST` với header `Authorization: <jwt>` (không có chữ `Bearer`). JWT ký HS256 bằng api secret, `iss` = api key, claim `sha256` = base64 chuẩn của SHA-256 trên **nguyên body**.

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitWebhookEvent.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitWebhookVerifier.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/LiveKitWebhookVerifierTest.java`

**Interfaces:**
- Consumes: `LiveKitProperties` (Task 1).
- Produces: `boolean LiveKitWebhookVerifier.verify(String authorizationHeader, String body)`; record `LiveKitWebhookEvent(String id, String event, Room room, Participant participant)` với `Room(String name, String sid)`, `Participant(String identity, String name, String sid)`; hằng `PARTICIPANT_JOINED = "participant_joined"`, `PARTICIPANT_LEFT = "participant_left"`, `ROOM_FINISHED = "room_finished"`.

- [ ] **Step 1: Viết test thất bại**

```java
package com.platform.chatservice.service.rtc;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.config.LiveKitProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LiveKitWebhookVerifierTest {

  private static final String SECRET = "0123456789abcdef0123456789abcdef"; // gitleaks:allow
  private static final String BODY =
      "{\"event\":\"participant_joined\",\"room\":{\"name\":\"call_abc\"},"
          + "\"participant\":{\"identity\":\"user-1\"}}";

  private LiveKitProperties props;
  private LiveKitWebhookVerifier verifier;

  @BeforeEach
  void setUp() {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret(SECRET);
    verifier = new LiveKitWebhookVerifier(props);
  }

  private static String sha256(String body) throws Exception {
    byte[] digest =
        MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8));
    return Base64.getEncoder().encodeToString(digest);
  }

  /** What LiveKit sends: a token signed with the API secret, carrying the body hash. */
  private static String signed(String issuer, String secret, String hash, long ttlSeconds) {
    Instant now = Instant.now();
    return Jwts.builder()
        .setIssuer(issuer)
        .setNotBefore(Date.from(now.minusSeconds(5)))
        .setExpiration(Date.from(now.plusSeconds(ttlSeconds)))
        .claim("sha256", hash)
        .signWith(
            Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), SignatureAlgorithm.HS256)
        .compact();
  }

  @Test
  void acceptsAGenuineWebhook() throws Exception {
    assertThat(verifier.verify(signed("APIkey1", SECRET, sha256(BODY), 60), BODY)).isTrue();
  }

  @Test
  void acceptsABearerPrefix() throws Exception {
    assertThat(verifier.verify("Bearer " + signed("APIkey1", SECRET, sha256(BODY), 60), BODY))
        .isTrue();
  }

  @Test
  void rejectsATamperedBody() throws Exception {
    String header = signed("APIkey1", SECRET, sha256(BODY), 60);
    assertThat(verifier.verify(header, BODY.replace("user-1", "user-2"))).isFalse();
  }

  @Test
  void rejectsAnotherIssuer() throws Exception {
    assertThat(verifier.verify(signed("otherKey", SECRET, sha256(BODY), 60), BODY)).isFalse();
  }

  @Test
  void rejectsAnotherSecret() throws Exception {
    String other = "ffffffffffffffffffffffffffffffff";
    assertThat(verifier.verify(signed("APIkey1", other, sha256(BODY), 60), BODY)).isFalse();
  }

  @Test
  void rejectsAnExpiredToken() throws Exception {
    assertThat(verifier.verify(signed("APIkey1", SECRET, sha256(BODY), -10), BODY)).isFalse();
  }

  @Test
  void rejectsMissingHeaderOrBody() throws Exception {
    assertThat(verifier.verify(null, BODY)).isFalse();
    assertThat(verifier.verify("", BODY)).isFalse();
    assertThat(verifier.verify(signed("APIkey1", SECRET, sha256(BODY), 60), null)).isFalse();
  }

  @Test
  void rejectsEverythingWhenLiveKitIsOff() throws Exception {
    String header = signed("APIkey1", SECRET, sha256(BODY), 60);
    props.setUrl("");
    assertThat(verifier.verify(header, BODY)).isFalse();
  }
}
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: lệnh test chung với `-Dtest=LiveKitWebhookVerifierTest`
Expected: FAIL — `LiveKitWebhookVerifier` chưa tồn tại.

- [ ] **Step 3: Viết code**

`LiveKitWebhookEvent.java`:

```java
package com.platform.chatservice.service.rtc;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** The fields of a LiveKit webhook the platform uses; everything else is ignored. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LiveKitWebhookEvent(
    String id, String event, Room room, Participant participant) {

  public static final String PARTICIPANT_JOINED = "participant_joined";
  public static final String PARTICIPANT_LEFT = "participant_left";
  public static final String ROOM_FINISHED = "room_finished";

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Room(String name, String sid) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Participant(String identity, String name, String sid) {}
}
```

`LiveKitWebhookVerifier.java`:

```java
package com.platform.chatservice.service.rtc;

import com.platform.chatservice.config.LiveKitProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Checks that a webhook really came from our LiveKit server: the Authorization header is a token
 * signed with our API secret, issued by our API key, and its {@code sha256} claim matches the body.
 */
@Component
@RequiredArgsConstructor
public class LiveKitWebhookVerifier {

  private final LiveKitProperties props;

  public boolean verify(String authorizationHeader, String body) {
    if (!props.isConfigured() || !StringUtils.hasText(authorizationHeader) || body == null) {
      return false;
    }
    String token =
        authorizationHeader.startsWith("Bearer ")
            ? authorizationHeader.substring("Bearer ".length())
            : authorizationHeader;
    try {
      Claims claims =
          Jwts.parserBuilder()
              .setSigningKey(props.signingKey())
              .build()
              .parseClaimsJws(token)
              .getBody();
      if (!props.getApiKey().equals(claims.getIssuer())) {
        return false;
      }
      Object claimed = claims.get("sha256");
      if (claimed == null) {
        return false;
      }
      return MessageDigest.isEqual(
          sha256Base64(body).getBytes(StandardCharsets.UTF_8),
          claimed.toString().getBytes(StandardCharsets.UTF_8));
    } catch (JwtException | IllegalArgumentException e) {
      return false;
    }
  }

  private static String sha256Base64(String body) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is unavailable", e);
    }
  }
}
```

- [ ] **Step 4: Chạy lại, phải PASS**

Run: lệnh test chung với `-Dtest=LiveKitWebhookVerifierTest`
Expected: PASS (8 test).

- [ ] **Step 5: Commit**

```bash
git add apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitWebhookEvent.java \
  apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitWebhookVerifier.java \
  apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/LiveKitWebhookVerifierTest.java
git commit -m "feat(chat): verify LiveKit webhook signatures and body hash"
```

---

### Task 4: Nhận webhook và chuyển cho domain

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/RtcRoomEventHandler.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/RtcWebhookDispatcher.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/RtcWebhookController.java`
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/config/SecurityConfig.java` (khối `authorizeHttpRequests`, ngay sau matcher `GET /api/uploads/**`)
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/RtcWebhookDispatcherTest.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/controller/RtcWebhookControllerTest.java`

**Interfaces:**
- Consumes: `LiveKitWebhookVerifier.verify`, `LiveKitWebhookEvent` (Task 3).
- Produces: interface `RtcRoomEventHandler { boolean supports(String room); void onParticipantJoined(RtcParticipantEvent e); void onParticipantLeft(RtcParticipantEvent e); void onRoomFinished(String room); }` với `record RtcParticipantEvent(String room, String identity, String participantSid, String eventId, Instant createdAt)` *(đổi sau final review 2026-10-05 — xem ledger; code thật là chuẩn, khối code ở Task 4 bên dưới là bản trước review)* — `CallService` (plan Calls) và `MeetingService` (plan Meetings P1) cài interface này; `RtcWebhookDispatcher.dispatch(LiveKitWebhookEvent)`; route `POST /api/rtc/livekit/webhook` (ra ngoài qua Caddy: `/api/chat/api/rtc/livekit/webhook`).

- [ ] **Step 1: Viết test thất bại**

`RtcWebhookDispatcherTest.java`:

```java
package com.platform.chatservice.service.rtc;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class RtcWebhookDispatcherTest {

  /** Records what it receives; claims every room with its prefix. */
  static class Recording implements RtcRoomEventHandler {
    final String prefix;
    final List<String> calls = new ArrayList<>();
    boolean explode;

    Recording(String prefix) {
      this.prefix = prefix;
    }

    @Override
    public boolean supports(String room) {
      return room.startsWith(prefix);
    }

    @Override
    public void onParticipantJoined(String room, String identity) {
      if (explode) {
        throw new IllegalStateException("boom");
      }
      calls.add("joined " + room + " " + identity);
    }

    @Override
    public void onParticipantLeft(String room, String identity) {
      calls.add("left " + room + " " + identity);
    }

    @Override
    public void onRoomFinished(String room) {
      calls.add("finished " + room);
    }
  }

  private static LiveKitWebhookEvent event(String type, String room, String identity) {
    return new LiveKitWebhookEvent(
        "evt-1",
        type,
        new LiveKitWebhookEvent.Room(room, "RM_1"),
        identity == null ? null : new LiveKitWebhookEvent.Participant(identity, "A", "PA_1"));
  }

  @Test
  void routesEachEventToTheHandlerThatOwnsTheRoom() {
    Recording calls = new Recording(RtcRooms.CALL_PREFIX);
    Recording meetings = new Recording(RtcRooms.MEETING_PREFIX);
    RtcWebhookDispatcher dispatcher = new RtcWebhookDispatcher(List.of(calls, meetings));

    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_JOINED, "call_c1", "u1"));
    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_LEFT, "meet_m1", "u2"));
    dispatcher.dispatch(event(LiveKitWebhookEvent.ROOM_FINISHED, "meet_m1", null));

    assertThat(calls.calls).containsExactly("joined call_c1 u1");
    assertThat(meetings.calls).containsExactly("left meet_m1 u2", "finished meet_m1");
  }

  @Test
  void ignoresUnknownRoomsEventsAndIncompletePayloads() {
    Recording calls = new Recording(RtcRooms.CALL_PREFIX);
    RtcWebhookDispatcher dispatcher = new RtcWebhookDispatcher(List.of(calls));

    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_JOINED, "other_x", "u1"));
    dispatcher.dispatch(event("track_published", "call_c1", "u1"));
    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_JOINED, "call_c1", null));
    dispatcher.dispatch(new LiveKitWebhookEvent("e", LiveKitWebhookEvent.ROOM_FINISHED, null, null));
    dispatcher.dispatch(null);

    assertThat(calls.calls).isEmpty();
  }

  @Test
  void handlerFailureIsContained() {
    Recording calls = new Recording(RtcRooms.CALL_PREFIX);
    calls.explode = true;
    RtcWebhookDispatcher dispatcher = new RtcWebhookDispatcher(List.of(calls));

    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_JOINED, "call_c1", "u1"));

    assertThat(calls.calls).isEmpty(); // no exception escaped
  }
}
```

`RtcWebhookControllerTest.java`:

```java
package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.service.rtc.LiveKitWebhookEvent;
import com.platform.chatservice.service.rtc.LiveKitWebhookVerifier;
import com.platform.chatservice.service.rtc.RtcWebhookDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class RtcWebhookControllerTest {

  private static final String BODY =
      "{\"id\":\"evt-1\",\"event\":\"participant_left\",\"createdAt\":\"1700000000\","
          + "\"room\":{\"name\":\"call_abc\",\"sid\":\"RM_1\",\"numParticipants\":1},"
          + "\"participant\":{\"identity\":\"user-1\",\"name\":\"Alice\",\"state\":\"DISCONNECTED\"}}";

  @Mock private LiveKitWebhookVerifier verifier;
  @Mock private RtcWebhookDispatcher dispatcher;
  private RtcWebhookController controller;

  @BeforeEach
  void setUp() {
    controller = new RtcWebhookController(verifier, dispatcher, new ObjectMapper());
  }

  @Test
  void unverifiedWebhookIsRejectedWithoutDispatch() {
    when(verifier.verify("forged", BODY)).thenReturn(false);

    assertThat(controller.receive("forged", BODY).getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
    verify(dispatcher, never()).dispatch(any());
  }

  @Test
  void verifiedWebhookIsParsedAndDispatched() {
    when(verifier.verify("good", BODY)).thenReturn(true);

    assertThat(controller.receive("good", BODY).getStatusCode()).isEqualTo(HttpStatus.OK);
    ArgumentCaptor<LiveKitWebhookEvent> captor = ArgumentCaptor.forClass(LiveKitWebhookEvent.class);
    verify(dispatcher).dispatch(captor.capture());
    assertThat(captor.getValue().event()).isEqualTo("participant_left");
    assertThat(captor.getValue().room().name()).isEqualTo("call_abc");
    assertThat(captor.getValue().participant().identity()).isEqualTo("user-1");
  }

  @Test
  void malformedJsonIsABadRequest() {
    when(verifier.verify("good", "{not json")).thenReturn(true);

    assertThat(controller.receive("good", "{not json").getStatusCode())
        .isEqualTo(HttpStatus.BAD_REQUEST);
    verify(dispatcher, never()).dispatch(any());
  }
}
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: lệnh test chung với `-Dtest='RtcWebhookDispatcherTest,RtcWebhookControllerTest'`
Expected: FAIL — các class chưa tồn tại.

- [ ] **Step 3: Viết code**

`RtcRoomEventHandler.java`:

```java
package com.platform.chatservice.service.rtc;

/**
 * Implemented by each domain that owns LiveKit rooms (calls, meetings). The webhook is the source
 * of truth for who is in a room, so a crashed client can no longer leave a ghost participant.
 */
public interface RtcRoomEventHandler {

  /** True when this handler owns {@code room} (decided by the room-name prefix). */
  boolean supports(String room);

  void onParticipantJoined(String room, String identity);

  void onParticipantLeft(String room, String identity);

  void onRoomFinished(String room);
}
```

`RtcWebhookDispatcher.java`:

```java
package com.platform.chatservice.service.rtc;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Routes a verified LiveKit webhook to the domain that owns the room. A handler failure is logged
 * and swallowed: LiveKit treats a non-2xx answer as a delivery failure, and the event has already
 * been accepted.
 */
@Slf4j
@Service
public class RtcWebhookDispatcher {

  private final List<RtcRoomEventHandler> handlers;

  @Autowired
  public RtcWebhookDispatcher(ObjectProvider<RtcRoomEventHandler> handlers) {
    this(handlers.orderedStream().toList());
  }

  RtcWebhookDispatcher(List<RtcRoomEventHandler> handlers) {
    this.handlers = List.copyOf(handlers);
  }

  public void dispatch(LiveKitWebhookEvent event) {
    if (event == null || event.event() == null || event.room() == null) {
      return;
    }
    String room = event.room().name();
    if (room == null) {
      return;
    }
    handlers.stream()
        .filter(h -> h.supports(room))
        .findFirst()
        .ifPresentOrElse(
            h -> route(h, room, event),
            () -> log.debug("LiveKit webhook for unowned room {} ignored", room));
  }

  private void route(RtcRoomEventHandler handler, String room, LiveKitWebhookEvent event) {
    String identity = event.participant() == null ? null : event.participant().identity();
    try {
      switch (event.event()) {
        case LiveKitWebhookEvent.PARTICIPANT_JOINED -> {
          if (identity != null) {
            handler.onParticipantJoined(room, identity);
          }
        }
        case LiveKitWebhookEvent.PARTICIPANT_LEFT -> {
          if (identity != null) {
            handler.onParticipantLeft(room, identity);
          }
        }
        case LiveKitWebhookEvent.ROOM_FINISHED -> handler.onRoomFinished(room);
        default -> {
          // track_published, egress_*, … are not used yet.
        }
      }
    } catch (RuntimeException e) {
      log.error("LiveKit webhook {} for room {} failed", event.event(), room, e);
    }
  }
}
```

`RtcWebhookController.java`:

```java
package com.platform.chatservice.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.service.rtc.LiveKitWebhookEvent;
import com.platform.chatservice.service.rtc.LiveKitWebhookVerifier;
import com.platform.chatservice.service.rtc.RtcWebhookDispatcher;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Webhook from the LiveKit server. Not behind user JWT auth (SecurityConfig permits it): the
 * request authenticates itself with a token signed by the LiveKit API secret.
 */
@RestController
@RequestMapping("/api/rtc/livekit")
@RequiredArgsConstructor
public class RtcWebhookController {

  private final LiveKitWebhookVerifier verifier;
  private final RtcWebhookDispatcher dispatcher;
  private final ObjectMapper objectMapper;

  @PostMapping(value = "/webhook", consumes = MediaType.ALL_VALUE)
  public ResponseEntity<Void> receive(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestBody String body) {
    if (!verifier.verify(authorization, body)) {
      return ResponseEntity.status(401).build();
    }
    LiveKitWebhookEvent event;
    try {
      event = objectMapper.readValue(body, LiveKitWebhookEvent.class);
    } catch (JsonProcessingException e) {
      return ResponseEntity.badRequest().build();
    }
    dispatcher.dispatch(event);
    return ResponseEntity.ok().build();
  }
}
```

Trong `SecurityConfig.java`, ngay sau:

```java
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/uploads/**")
                    .permitAll()
```

thêm:

```java
                    // LiveKit webhook authenticates itself (token signed with the LiveKit API
                    // secret + body hash, see LiveKitWebhookVerifier); it carries no user JWT.
                    .requestMatchers(
                        org.springframework.http.HttpMethod.POST, "/api/rtc/livekit/webhook")
                    .permitAll()
```

- [ ] **Step 4: Chạy lại, phải PASS**

Run: lệnh test chung với `-Dtest='RtcWebhookDispatcherTest,RtcWebhookControllerTest,AssistantMappingUniquenessTest'`
Expected: PASS. `AssistantMappingUniquenessTest` chạy kèm để chắc route mới không trùng mapping (memory dự án: trùng mapping làm Spring crash lúc boot mà `mvn test` khác không bắt).

- [ ] **Step 5: Chạy toàn bộ test chat-service**

Run: `cd apps/server/chat-service && export JAVA_HOME=$(/usr/libexec/java_home -v 21) && mvn -q spotless:check && mvn -q test`
Expected: PASS (cần Docker cho Testcontainers).

- [ ] **Step 6: Kiểm tra route thật qua Spring Security**

Chạy chat-service local (nhánh `dev`, `./scripts/dev/up.sh`) rồi:

```bash
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' -X POST \
  http://localhost:8080/api/rtc/livekit/webhook -H 'Authorization: forged' -d '{}'
```

Expected: `401 0` — 401 **body rỗng** là của controller. Nếu ra 401 kèm JSON `Full authentication is required` thì matcher trong `SecurityConfig` chưa đúng.

- [ ] **Step 7: Commit**

```bash
git add apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/RtcRoomEventHandler.java \
  apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/RtcWebhookDispatcher.java \
  apps/server/chat-service/src/main/java/com/platform/chatservice/controller/RtcWebhookController.java \
  apps/server/chat-service/src/main/java/com/platform/chatservice/config/SecurityConfig.java \
  apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/RtcWebhookDispatcherTest.java \
  apps/server/chat-service/src/test/java/com/platform/chatservice/controller/RtcWebhookControllerTest.java
git commit -m "feat(chat): receive LiveKit webhooks and route them by room"
```

---

### Task 5: Room API (Twirp)

LiveKit server API là Twirp: `POST {api}/twirp/livekit.RoomService/<Method>`, `Content-Type: application/json`, `Authorization: Bearer <server token>`. Body dùng tên field protobuf (snake_case). Enum `source` của track trả về dạng chuỗi (`"MICROPHONE"`) hoặc số (`2`) tuỳ phiên bản — chuẩn hoá về chuỗi.

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitApiException.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitRoomClient.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/LiveKitRoomClientTest.java`

**Interfaces:**
- Consumes: `LiveKitProperties.resolvedApiUrl()` (Task 1), `LiveKitTokenService.serverToken(String)` (Task 2).
- Produces: `List<LiveKitRoomClient.RoomParticipant> listParticipants(String room)`; `void mutePublishedTrack(String room, String identity, String trackSid, boolean muted)`; `void removeParticipant(String room, String identity)`; `void deleteRoom(String room)`; records `RoomParticipant(String identity, String name, List<RoomTrack> tracks)`, `RoomTrack(String sid, String source, boolean muted)` (source ∈ `CAMERA|MICROPHONE|SCREEN_SHARE|SCREEN_SHARE_AUDIO|UNKNOWN`); `LiveKitApiException(String method, int status)` với `method()`, `status()` (status = -1 khi lỗi mạng).

- [ ] **Step 1: Viết test thất bại**

```java
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
    props.setApiSecret("0123456789abcdef0123456789abcdef"); // gitleaks:allow
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
    assertThat(request.uri().getPath())
        .isEqualTo("/twirp/livekit.RoomService/MutePublishedTrack");
    assertThat(new ObjectMapper().readValue(bodyOf(request), Map.class))
        .isEqualTo(Map.of("room", "meet_1", "identity", "user-1", "track_sid", "TR_1", "muted", true));
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
}
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: lệnh test chung với `-Dtest=LiveKitRoomClientTest`
Expected: FAIL — `LiveKitRoomClient` chưa tồn tại.

- [ ] **Step 3: Viết code**

`LiveKitApiException.java`:

```java
package com.platform.chatservice.service.rtc;

/** A LiveKit room-API call failed. {@code status} is the HTTP status, or -1 for a network error. */
public class LiveKitApiException extends RuntimeException {

  private final String method;
  private final int status;

  public LiveKitApiException(String method, int status, Throwable cause) {
    super("LiveKit " + method + " failed (status " + status + ")", cause);
    this.method = method;
    this.status = status;
  }

  public String method() {
    return method;
  }

  public int status() {
    return status;
  }
}
```

`LiveKitRoomClient.java`:

```java
package com.platform.chatservice.service.rtc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.LiveKitProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The slice of LiveKit's RoomService the platform needs (host controls, ending a room). Twirp over
 * JSON with the JDK HttpClient, so there is no LiveKit SDK on the server.
 */
@Service
public class LiveKitRoomClient {

  private static final String SERVICE_PATH = "/twirp/livekit.RoomService/";
  private static final Duration TIMEOUT = Duration.ofSeconds(5);
  /** livekit.TrackSource numbering, for servers that send the enum as a number. */
  private static final List<String> SOURCES =
      List.of("UNKNOWN", "CAMERA", "MICROPHONE", "SCREEN_SHARE", "SCREEN_SHARE_AUDIO");

  public record RoomTrack(String sid, String source, boolean muted) {}

  public record RoomParticipant(String identity, String name, List<RoomTrack> tracks) {}

  private final LiveKitProperties props;
  private final LiveKitTokenService tokens;
  private final ObjectMapper objectMapper;
  private final HttpClient http;

  @Autowired
  public LiveKitRoomClient(
      LiveKitProperties props, LiveKitTokenService tokens, ObjectMapper objectMapper) {
    this(props, tokens, objectMapper, HttpClient.newBuilder().connectTimeout(TIMEOUT).build());
  }

  LiveKitRoomClient(
      LiveKitProperties props,
      LiveKitTokenService tokens,
      ObjectMapper objectMapper,
      HttpClient http) {
    this.props = props;
    this.tokens = tokens;
    this.objectMapper = objectMapper;
    this.http = http;
  }

  public List<RoomParticipant> listParticipants(String room) {
    JsonNode body = call("ListParticipants", room, Map.of("room", room));
    List<RoomParticipant> out = new ArrayList<>();
    for (JsonNode p : body.path("participants")) {
      List<RoomTrack> tracks = new ArrayList<>();
      for (JsonNode t : p.path("tracks")) {
        tracks.add(
            new RoomTrack(
                t.path("sid").asText(null), source(t.path("source")), t.path("muted").asBoolean()));
      }
      out.add(new RoomParticipant(p.path("identity").asText(null), p.path("name").asText(null), tracks));
    }
    return out;
  }

  public void mutePublishedTrack(String room, String identity, String trackSid, boolean muted) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("room", room);
    body.put("identity", identity);
    body.put("track_sid", trackSid);
    body.put("muted", muted);
    call("MutePublishedTrack", room, body);
  }

  public void removeParticipant(String room, String identity) {
    call("RemoveParticipant", room, Map.of("room", room, "identity", identity));
  }

  public void deleteRoom(String room) {
    call("DeleteRoom", room, Map.of("room", room));
  }

  private JsonNode call(String method, String room, Map<String, Object> body) {
    if (!props.isConfigured()) {
      throw new LiveKitUnavailableException();
    }
    HttpRequest request;
    try {
      request =
          HttpRequest.newBuilder(URI.create(props.resolvedApiUrl() + SERVICE_PATH + method))
              .timeout(TIMEOUT)
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + tokens.serverToken(room))
              .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
              .build();
    } catch (JsonProcessingException e) {
      throw new LiveKitApiException(method, -1, e);
    }
    try {
      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        throw new LiveKitApiException(method, response.statusCode(), null);
      }
      String text = response.body();
      return objectMapper.readTree(text == null || text.isBlank() ? "{}" : text);
    } catch (IOException e) {
      throw new LiveKitApiException(method, -1, e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LiveKitApiException(method, -1, e);
    }
  }

  private static String source(JsonNode node) {
    if (node.isNumber()) {
      int i = node.asInt();
      return i >= 0 && i < SOURCES.size() ? SOURCES.get(i) : "UNKNOWN";
    }
    String text = node.asText("");
    return SOURCES.contains(text) ? text : "UNKNOWN";
  }
}
```

- [ ] **Step 4: Chạy lại, phải PASS**

Run: lệnh test chung với `-Dtest=LiveKitRoomClientTest`
Expected: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
git add apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitApiException.java \
  apps/server/chat-service/src/main/java/com/platform/chatservice/service/rtc/LiveKitRoomClient.java \
  apps/server/chat-service/src/test/java/com/platform/chatservice/service/rtc/LiveKitRoomClientTest.java
git commit -m "feat(chat): LiveKit room API client for host controls"
```

---

### Task 6: Chặn khởi động prod khi cấu hình LiveKit sai

**Files:**
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/config/ProdEnvironmentGuard.java` (`verify()` và thêm `findLiveKitProblems`)
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/config/ProdEnvironmentGuardTest.java` (thêm test vào cuối class)

**Interfaces:**
- Produces: `static List<String> ProdEnvironmentGuard.findLiveKitProblems(UnaryOperator<String> resolver)`.

- [ ] **Step 1: Viết test thất bại** — thêm vào cuối `ProdEnvironmentGuardTest`, trước `}` cuối:

```java
  private static List<String> liveKit(Map<String, String> env) {
    return ProdEnvironmentGuard.findLiveKitProblems(env::get);
  }

  @Test
  @DisplayName("LiveKit unset with calls on mesh is fine — meetings just report unavailable")
  void liveKitOptionalOnMesh() {
    assertThat(liveKit(Map.of("app.livekit.call-transport", "mesh"))).isEmpty();
  }

  @Test
  @DisplayName("calls on sfu without LiveKit refuse to start")
  void sfuNeedsLiveKit() {
    List<String> problems = liveKit(Map.of("app.livekit.call-transport", "sfu"));
    assertThat(problems).hasSize(1);
    assertThat(problems.get(0)).contains("CALL_TRANSPORT=sfu");
  }

  @Test
  @DisplayName("a loopback LiveKit URL or a short secret is rejected")
  void loopbackUrlAndShortSecretRejected() {
    Map<String, String> env =
        Map.of(
            "app.livekit.url", "ws://localhost:7880",
            "app.livekit.api-key", "devkey",
            "app.livekit.api-secret", "secret");
    assertThat(liveKit(env)).hasSize(2);
  }

  @Test
  @DisplayName("a complete external LiveKit config on sfu passes")
  void completeSfuPasses() {
    Map<String, String> env =
        Map.of(
            "app.livekit.call-transport", "sfu",
            "app.livekit.url", "wss://rtc.example.com",
            "app.livekit.api-key", "APIabc",
            "app.livekit.api-secret", "0123456789abcdef0123456789abcdef"); // gitleaks:allow
    assertThat(liveKit(env)).isEmpty();
  }
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: lệnh test chung với `-Dtest=ProdEnvironmentGuardTest`
Expected: FAIL — `findLiveKitProblems` chưa tồn tại.

- [ ] **Step 3: Viết code**

Trong `verify()`, thay

```java
    List<String> problems = findProblems(environment::getProperty);
```

bằng

```java
    List<String> problems = new ArrayList<>(findProblems(environment::getProperty));
    problems.addAll(findLiveKitProblems(environment::getProperty));
```

Thêm method sau `findProblems(...)`:

```java
  /**
   * LiveKit is optional (blank = calls stay P2P, meetings unavailable), but a half-configured one
   * is not: calls switched to sfu with nothing to connect to, a URL no client can reach, or a
   * secret LiveKit itself would refuse.
   */
  static List<String> findLiveKitProblems(UnaryOperator<String> resolver) {
    List<String> problems = new ArrayList<>();
    String url = resolver.apply("app.livekit.url");
    String key = resolver.apply("app.livekit.api-key");
    String secret = resolver.apply("app.livekit.api-secret");
    boolean configured = !isBlank(url) && !isBlank(key) && !isBlank(secret);
    if ("sfu".equalsIgnoreCase(resolver.apply("app.livekit.call-transport")) && !configured) {
      problems.add(
          "CALL_TRANSPORT=sfu but LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not all set");
    }
    if (!isBlank(url) && pointsAtLoopback(url)) {
      problems.add(
          "app.livekit.url = " + url + " — clients cannot reach this container; set LIVEKIT_URL");
    }
    if (!isBlank(secret) && secret.length() < LiveKitProperties.MIN_SECRET_LENGTH) {
      problems.add("LIVEKIT_API_SECRET is shorter than 32 characters");
    }
    return problems;
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
```

(`LiveKitProperties.MIN_SECRET_LENGTH` là package-private trong cùng package `config` — dùng được. Nếu `ArrayList` chưa được import thì thêm `import java.util.ArrayList;`.)

- [ ] **Step 4: Chạy lại, phải PASS**

Run: lệnh test chung với `-Dtest=ProdEnvironmentGuardTest`
Expected: PASS (test cũ + 4 test mới).

- [ ] **Step 5: Commit**

```bash
git add apps/server/chat-service/src/main/java/com/platform/chatservice/config/ProdEnvironmentGuard.java \
  apps/server/chat-service/src/test/java/com/platform/chatservice/config/ProdEnvironmentGuardTest.java
git commit -m "feat(chat): refuse a half-configured LiveKit in production"
```

---

### Task 7: Self-host — LiveKit chạy cùng stack

Khách tự host (`compose.prod.yml`, Linux) chạy LiveKit trên chính máy đó. LiveKit dùng **host networking** (dải UDP rộng + IP công khai thật; publish 10.000 cổng qua docker-proxy rất nặng). Tín hiệu WebSocket đi qua Caddy ở `rtc.<DOMAIN>` (TLS tự động); media đi thẳng vào host.

**Files:**
- Modify: `infra/docker-compose/compose.prod.yml` (service mới `livekit`; env của `chat-service`; `extra_hosts` của `caddy`)
- Modify: `infra/docker-compose/Caddyfile` (site mới cuối file)
- Modify: `infra/docker-compose/.env.example` (HUMAN + AUTO-GENERATED)
- Modify: `infra/docker-compose/bootstrap.sh` (sau `fill_secret INTERNAL_API_KEY ...`)
- Modify: `infra/docker-compose/bootstrap.test.sh`
- Modify: `docs/superpowers/runbooks/self-host.md` (mục DNS + firewall)

- [ ] **Step 1: Viết test thất bại** — trong `bootstrap.test.sh`, ngay sau dòng kiểm vault key 32 byte (`[ "$LEN" = "32" ] || ...`), thêm:

```bash
# LiveKit: key present, secret long enough for LiveKit outside --dev (>= 32 chars).
LK1="$(get LIVEKIT_API_KEY)"; LS1="$(get LIVEKIT_API_SECRET)"
[ -n "$LK1" ] || { echo "FAIL: LIVEKIT_API_KEY not generated"; exit 1; }
[ "${#LS1}" -ge 32 ] || { echo "FAIL: LIVEKIT_API_SECRET shorter than 32 chars"; exit 1; }
```

và ngay sau dòng kiểm vault key không đổi khi chạy lại (`[ "$(get CONNECTOR_VAULT_KEY)" = "$V1" ] || ...`), thêm:

```bash
[ "$(get LIVEKIT_API_SECRET)" = "$LS1" ] || { echo "FAIL: LiveKit secret changed on re-run"; exit 1; }
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: `bash infra/docker-compose/bootstrap.test.sh`
Expected: `FAIL: LIVEKIT_API_KEY not generated`

- [ ] **Step 3: Sinh secret** — trong `bootstrap.sh`, ngay sau `fill_secret INTERNAL_API_KEY   "openssl rand -hex 32"`:

```bash
# LiveKit media server (calls + meetings). The key is a public name, the secret
# signs every access token and webhook; LiveKit wants >= 32 characters.
fill_secret LIVEKIT_API_KEY    "echo API$(openssl rand -hex 6)"
fill_secret LIVEKIT_API_SECRET "openssl rand -hex 32"
```

Trong `.env.example`, khối AUTO-GENERATED, ngay sau `INTERNAL_API_KEY=`:

```bash
# LiveKit media server for calls and meetings — key name + signing secret,
# shared by the livekit container and chat-service.
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Trong khối HUMAN MUST SET, ngay trước dòng `# ---------- AUTO-GENERATED`:

```bash
# Calls: "mesh" (peer-to-peer, the default) or "sfu" (through LiveKit — works
# behind 4G / corporate NAT). Meetings always use LiveKit. Needs DNS for
# rtc.${DOMAIN} and the firewall ports in docs/superpowers/runbooks/self-host.md.
CALL_TRANSPORT=
```

- [ ] **Step 4: Chạy lại test bootstrap, phải PASS**

Run: `bash infra/docker-compose/bootstrap.test.sh`
Expected: `PASS`

- [ ] **Step 5: Thêm LiveKit vào compose** — trong `compose.prod.yml`, thêm service ngay trước `caddy:`:

```yaml
  # Media server for calls and meetings
  # (docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md).
  # Host networking: WebRTC needs the host's real public IP and a wide UDP range;
  # publishing 10,000 ports through docker-proxy one by one is not workable.
  # Signalling reaches it through Caddy at rtc.${DOMAIN}; media goes straight to
  # the host: UDP 50000-60000, TCP 7881, TURN UDP 3478.
  livekit:
    image: livekit/livekit-server:v1.8
    network_mode: host
    environment:
      LIVEKIT_CONFIG: |
        port: 7880
        rtc:
          tcp_port: 7881
          port_range_start: 50000
          port_range_end: 60000
          use_external_ip: true
        turn:
          enabled: true
          domain: rtc.${DOMAIN}
          udp_port: 3478
        keys:
          ${LIVEKIT_API_KEY:?run bootstrap.sh}: ${LIVEKIT_API_SECRET:?run bootstrap.sh}
        webhook:
          api_key: ${LIVEKIT_API_KEY:?run bootstrap.sh}
          urls:
            - https://${DOMAIN}/api/chat/api/rtc/livekit/webhook
        room:
          auto_create: true
          max_participants: 25
          empty_timeout: 300
    restart: unless-stopped
```

Trong `chat-service.environment`, ngay sau `SPRING_MAIL_PASSWORD: ${MAIL_PASS:-}`:

```yaml
      LIVEKIT_URL: wss://rtc.${DOMAIN}
      LIVEKIT_API_URL: https://rtc.${DOMAIN}
      LIVEKIT_API_KEY: ${LIVEKIT_API_KEY:?run bootstrap.sh}
      LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET:?run bootstrap.sh}
      CALL_TRANSPORT: ${CALL_TRANSPORT:-mesh}
```

Trong `caddy:`, thêm (cùng cấp với `ports:`):

```yaml
    # livekit runs on the host network; this name reaches it from the bridge.
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Cuối `Caddyfile`:

```
# LiveKit signalling (WebSocket) and its server API. Media never passes through
# here — it goes straight to the host (UDP 50000-60000, TCP 7881, TURN 3478).
rtc.{$DOMAIN:localhost} {
	reverse_proxy host.docker.internal:7880
}
```

- [ ] **Step 6: Kiểm tra cấu hình**

```bash
cd infra/docker-compose && T="$(mktemp -d)" && cp .env.example "$T/.env.example" && \
  ENV_DIR="$T" ./bootstrap.sh --no-validate >/dev/null 2>&1; \
  DOMAIN=example.com docker compose -f compose.prod.yml --env-file "$T/.env" config --quiet && echo COMPOSE_OK; \
  docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" -e DOMAIN=example.com caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; \
  rm -rf "$T"
cd ../.. && bash scripts/ci/check-env-parity.sh && bash scripts/ci/check-env-leaks.sh
```

Expected: `COMPOSE_OK`, `Valid configuration`, hai gate CI xanh.

- [ ] **Step 7: Runbook self-host** — trong `docs/superpowers/runbooks/self-host.md`, thêm mục:

```markdown
## Cuộc gọi & Phòng họp (LiveKit)

LiveKit chạy cùng stack (`livekit` trong `compose.prod.yml`). Cần thêm:

1. **DNS:** bản ghi A `rtc.<DOMAIN>` trỏ về **cùng IP** với `<DOMAIN>` (nếu dùng Cloudflare
   thì để *DNS only* — proxy của Cloudflare không chuyển UDP).
2. **Firewall máy chủ:** mở `443/tcp` (đã có), `7881/tcp`, `3478/udp`, `50000-60000/udp`.
   **Không** mở `7880` ra ngoài — Caddy đã proxy nó qua `rtc.<DOMAIN>`.
3. **Bật cho cuộc gọi:** `CALL_TRANSPORT=sfu` trong `.env`, rồi
   `docker compose -f compose.prod.yml up -d chat-service`. Quay lại P2P: đặt `mesh`.
   Phòng họp luôn dùng LiveKit, không cần cờ.
4. **Kiểm tra:** `curl -s https://rtc.<DOMAIN>` trả `OK`; log
   `docker compose -f compose.prod.yml logs livekit` không có lỗi `port`/`TURN`.
```

- [ ] **Step 8: Commit**

```bash
git add infra/docker-compose/compose.prod.yml infra/docker-compose/Caddyfile \
  infra/docker-compose/.env.example infra/docker-compose/bootstrap.sh \
  infra/docker-compose/bootstrap.test.sh docs/superpowers/runbooks/self-host.md
git commit -m "feat(infra): run LiveKit in the self-host stack"
```

---

### Task 8: Máy media riêng cho triển khai Mac mini

Prod hiện chạy trên Mac mini sau Cloudflare Tunnel, không chuyển được UDP. Phương án khuyến nghị (spec §8) là **một VPS riêng** chỉ chạy LiveKit + Caddy; chat-service trên mini gọi nó qua Internet. Nếu owner chọn chạy trên chính mini thì bỏ qua `infra/livekit/` và làm theo mục "Phương án Mac mini" trong runbook.

**Files:**
- Create: `infra/livekit/compose.livekit.yml`
- Create: `infra/livekit/Caddyfile`
- Create: `infra/livekit/.env.livekit.example`
- Modify: `infra/docker-compose/compose.mini.yml` (env `chat-service`)
- Modify: `infra/docker-compose/.env.mini.example` (mục mới trước `# ---------- 6. ROLLOUT`)
- Modify: `scripts/ci/check-env-parity.sh` (thêm cặp compose/example mới vào check #1)
- Create: `docs/superpowers/runbooks/livekit.md`

- [ ] **Step 1: Gate CI phải bắt được biến thiếu** — trong `scripts/ci/check-env-parity.sh`, ngay sau dòng `check_required_documented infra/docker-compose/compose.prod.yml infra/docker-compose/.env.example`, thêm:

```bash
check_required_documented infra/livekit/compose.livekit.yml infra/livekit/.env.livekit.example
```

Run: `bash scripts/ci/check-env-parity.sh`
Expected: vẫn xanh (file chưa tồn tại thì hàm bỏ qua — `[ -f ... ] || return 0`).

- [ ] **Step 2: Tạo `infra/livekit/compose.livekit.yml`**

```yaml
# LiveKit on its own host — for deployments whose API host cannot take UDP
# (the Mac mini behind Cloudflare Tunnel). Runbook: docs/superpowers/runbooks/livekit.md
#
#   cp .env.livekit.example .env.livekit   # fill it in
#   docker compose -f compose.livekit.yml --env-file .env.livekit up -d
name: pon-livekit

services:
  # Host networking: WebRTC needs the host's public IP and a wide UDP range.
  livekit:
    image: livekit/livekit-server:v1.8
    network_mode: host
    environment:
      LIVEKIT_CONFIG: |
        port: 7880
        rtc:
          tcp_port: 7881
          port_range_start: 50000
          port_range_end: 60000
          use_external_ip: true
        turn:
          enabled: true
          domain: ${LIVEKIT_DOMAIN:?set LIVEKIT_DOMAIN, e.g. rtc.example.com}
          udp_port: 3478
        keys:
          ${LIVEKIT_API_KEY:?required}: ${LIVEKIT_API_SECRET:?required, 32+ chars}
        webhook:
          api_key: ${LIVEKIT_API_KEY:?required}
          urls:
            - ${LIVEKIT_WEBHOOK_URL:?set to https://<api host>/api/chat/api/rtc/livekit/webhook}
        room:
          auto_create: true
          max_participants: 25
          empty_timeout: 300
    restart: unless-stopped

  # TLS for signalling (wss://LIVEKIT_DOMAIN) — automatic Let's Encrypt.
  caddy:
    image: caddy:2
    network_mode: host
    environment:
      LIVEKIT_DOMAIN: ${LIVEKIT_DOMAIN:?required}
      ACME_EMAIL: ${ACME_EMAIL:?required for Let's Encrypt}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

`infra/livekit/Caddyfile`:

```
{
	email {$ACME_EMAIL}
}

# Signalling + server API. Media goes straight to the host on UDP/TCP.
{$LIVEKIT_DOMAIN} {
	reverse_proxy 127.0.0.1:7880
}
```

`infra/livekit/.env.livekit.example`:

```bash
# ============================================================================
# LiveKit media host. Copy to .env.livekit (gitignored) and fill every line.
# Runbook: docs/superpowers/runbooks/livekit.md
# ============================================================================
# Public name of this host; DNS A record -> this host's IP, NOT proxied.
LIVEKIT_DOMAIN=
# For the Let's Encrypt certificate.
ACME_EMAIL=
# Must equal the values chat-service has (.env.mini).
#   LIVEKIT_API_KEY:    echo API$(openssl rand -hex 6)
#   LIVEKIT_API_SECRET: openssl rand -hex 32
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
# Where LiveKit reports joins/leaves: https://<api host>/api/chat/api/rtc/livekit/webhook
LIVEKIT_WEBHOOK_URL=
```

Đảm bảo `.env.livekit` bị gitignore:

```bash
git check-ignore -q infra/livekit/.env.livekit || echo 'infra/livekit/.env.livekit' >> .gitignore
```

- [ ] **Step 3: chat-service trên mini trỏ tới máy media** — trong `compose.mini.yml`, `chat-service.environment`, ngay sau `BOTFACTORY_WORKER_TOKEN: ${BOTFACTORY_WORKER_TOKEN:-}`:

```yaml
      # LiveKit media host (infra/livekit/, runbook docs/superpowers/runbooks/livekit.md).
      # Blank = calls stay peer-to-peer and meetings report unavailable.
      LIVEKIT_URL: ${LIVEKIT_URL:-}
      LIVEKIT_API_KEY: ${LIVEKIT_API_KEY:-}
      LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET:-}
      CALL_TRANSPORT: ${CALL_TRANSPORT:-mesh}
```

Trong `.env.mini.example`, ngay trước `# ---------- 6. ROLLOUT ----------`:

```bash
# LiveKit media host for calls and meetings (blank = calls stay peer-to-peer,
# meetings unavailable). The mini cannot take UDP through the tunnel, so this
# runs elsewhere — see docs/superpowers/runbooks/livekit.md.
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
# mesh | sfu. Switch calls to sfu only after LiveKit answers on LIVEKIT_URL.
CALL_TRANSPORT=
```

- [ ] **Step 4: Runbook `docs/superpowers/runbooks/livekit.md`**

```markdown
# LiveKit media host

Calls (with `CALL_TRANSPORT=sfu`) and meetings send audio/video through LiveKit.
The Mac mini is behind Cloudflare Tunnel, which carries HTTP and WebSocket but
**not UDP**, so LiveKit needs a host with a public IP.

## Phương án khuyến nghị — VPS riêng

1. VPS Linux ~4 vCPU / 4 GB (trần 25 người/phòng), Docker + compose plugin.
2. DNS: `rtc.<domain>` → IP của VPS, **DNS only** (mây xám nếu dùng Cloudflare).
3. Firewall: mở `80/tcp`, `443/tcp`, `7881/tcp`, `3478/udp`, `50000-60000/udp`.
   Không mở `7880`.
4. Trên VPS:
   ```bash
   git clone <repo> pon && cd pon/infra/livekit
   cp .env.livekit.example .env.livekit   # điền đủ
   docker compose -f compose.livekit.yml --env-file .env.livekit up -d
   ```
5. Trên mini, điền mục LiveKit trong `.env.mini` (`LIVEKIT_URL=wss://rtc.<domain>`, key/secret
   **giống hệt** `.env.livekit`), rồi `scripts/mini/up.sh`.
6. Kiểm tra:
   - `curl -s https://rtc.<domain>` → `OK`.
   - Log chat-service không có lỗi `ProdEnvironmentGuard`.
   - Sau khi plan Calls/Meetings có client: hai máy khác mạng (một máy 4G) vào cùng phòng,
     nghe/thấy nhau; log chat-service có dòng nhận webhook `participant_joined`.
7. Bật cho cuộc gọi: `CALL_TRANSPORT=sfu` trong `.env.mini` → `scripts/mini/up.sh`.
   Rollback: `CALL_TRANSPORT=mesh`.

## Phương án Mac mini (chỉ khi owner chọn)

Chỉ làm được nếu mạng nhà **không** bị CGNAT: IP WAN trên trang router phải trùng với
`curl -4 ifconfig.me` chạy trên mini (IP dạng `100.64.x.x`–`100.127.x.x` là CGNAT).

- Chạy LiveKit **native** (`brew install livekit` + launchd), không qua Docker Desktop
  (Docker Desktop trên macOS xử lý dải UDP kém — QUIC của cloudflared từng chết im vì lý do này).
- Router: port-forward `7881/tcp`, `3478/udp`, `50000-60000/udp` về mini; DDNS cho
  `rtc.<domain>` (DNS only ⇒ **lộ IP nhà**); bật firewall IPv6 trên router trước.
- Tín hiệu `wss://rtc.<domain>` có thể đi qua Cloudflare Tunnel (thêm ingress), media thì không.
- Viết plan riêng cho phương án này trước khi làm.
```

- [ ] **Step 5: Kiểm tra**

```bash
cd infra/livekit && cp .env.livekit.example /tmp/lk.env && \
  sed -i '' 's|^LIVEKIT_DOMAIN=.*|LIVEKIT_DOMAIN=rtc.example.com|; s|^ACME_EMAIL=.*|ACME_EMAIL=a@example.com|; s|^LIVEKIT_API_KEY=.*|LIVEKIT_API_KEY=APIabc|; s|^LIVEKIT_API_SECRET=.*|LIVEKIT_API_SECRET=0123456789abcdef0123456789abcdef|; s|^LIVEKIT_WEBHOOK_URL=.*|LIVEKIT_WEBHOOK_URL=https://api.example.com/api/chat/api/rtc/livekit/webhook|' /tmp/lk.env && \ // gitleaks:allow
  docker compose -f compose.livekit.yml --env-file /tmp/lk.env config --quiet && echo LIVEKIT_COMPOSE_OK; rm -f /tmp/lk.env
cd ../docker-compose && docker compose -f compose.mini.yml --env-file .env.mini.example config --quiet 2>&1 | head -3
cd ../.. && bash scripts/ci/check-env-parity.sh && bash scripts/ci/check-env-leaks.sh && bash scripts/ci/check-dev-only.sh
```

Expected: `LIVEKIT_COMPOSE_OK`; dòng `compose.mini.yml` chỉ báo các biến `:?` **đã có từ trước** (file example để trống) — không có biến LIVEKIT nào; ba gate CI xanh.

- [ ] **Step 6: Commit**

```bash
git add infra/livekit/ infra/docker-compose/compose.mini.yml infra/docker-compose/.env.mini.example \
  scripts/ci/check-env-parity.sh docs/superpowers/runbooks/livekit.md .gitignore
git commit -m "feat(infra): standalone LiveKit host for the Mac mini deployment"
```

---

### Task 9: LiveKit cho dev local (chỉ nhánh `dev`)

**Không làm trên `feat/rtc-foundation`.** Sau khi Task 1–8 đã merge vào `dev`:

**Files (trên `dev`):**
- Modify: `infra/docker-compose/compose.yml` (service `livekit` chế độ dev; env LiveKit cho `chat-service`)
- Modify: `scripts/dev/up.sh` nếu nó liệt kê service cần chờ healthy

- [ ] **Step 1: Thêm service** — trong `compose.yml` (nhánh `dev`):

```yaml
  # Local LiveKit [dev-only]. Not --dev mode: its built-in secret is shorter than
  # the 32 chars chat-service requires, so give it a dev key pair instead.
  livekit:
    image: livekit/livekit-server:v1.8
    command: --node-ip 127.0.0.1 --bind 0.0.0.0
    environment:
      LIVEKIT_KEYS: "devkey: devsecret-devsecret-devsecret-0001"
      LIVEKIT_CONFIG: |
        port: 7880
        rtc:
          tcp_port: 7881
          port_range_start: 50000
          port_range_end: 50100
          use_external_ip: false
        webhook:
          api_key: devkey
          urls:
            - http://chat-service:8080/api/rtc/livekit/webhook
        room:
          auto_create: true
          max_participants: 25
    ports:
      - "7880:7880"
      - "7881:7881"
      - "50000-50100:50000-50100/udp"
```

Trong `chat-service.environment` của `compose.yml`:

```yaml
      LIVEKIT_URL: ws://localhost:7880
      LIVEKIT_API_URL: http://livekit:7880
      LIVEKIT_API_KEY: devkey
      LIVEKIT_API_SECRET: devsecret-devsecret-devsecret-0001
      CALL_TRANSPORT: ${CALL_TRANSPORT:-mesh}
```

Nếu chat-service được chạy ngoài Docker (`pnpm chat`), đặt cùng các biến này trong env của nó, với `LIVEKIT_API_URL=http://localhost:7880`.

- [ ] **Step 2: Kiểm tra**

```bash
./scripts/dev/up.sh --build
curl -s http://localhost:7880 && echo
```

Expected: `OK`. Log chat-service không có lỗi khởi động.

- [ ] **Step 3: Commit trên `dev`**

```bash
git add infra/docker-compose/compose.yml scripts/dev/up.sh
git commit -m "chore(dev): local LiveKit for calls and meetings [dev-only]"
```

---

### Task 10: Tài liệu

**Files:**
- Modify: `CLAUDE.md` (bảng "Ports & Infrastructure")
- Modify: `docs/environments.md` (bảng 3 môi trường + biến mới)
- Modify: `docs/superpowers/plans/README.md` (trạng thái plan này)

- [ ] **Step 1:** Thêm vào bảng Ports của `CLAUDE.md`:

```markdown
| LiveKit (signalling / API) | 7880 (sau Caddy: `rtc.<domain>`) | LiveKit SFU |
| LiveKit media | 7881/tcp, 3478/udp (TURN), 50000–60000/udp | LiveKit SFU |
```

- [ ] **Step 2:** Trong `docs/environments.md`, thêm một dòng "LiveKit" vào bảng môi trường: Local = container `livekit` trên `dev` (`ws://localhost:7880`); Production (Mac mini) = máy media riêng, `infra/livekit/`; Self-host = service `livekit` trong `compose.prod.yml` (`wss://rtc.<DOMAIN>`). Thêm `CALL_TRANSPORT` vào phần biến: `mesh` mặc định, `sfu` đưa cuộc gọi qua LiveKit, rollback bằng cách đổi lại.

- [ ] **Step 3:** Cập nhật dòng của plan này trong `docs/superpowers/plans/README.md` thành Done, ghi commit cuối và số test chat-service.

- [ ] **Step 4: Kiểm tra toàn bộ**

```bash
(cd apps/server/chat-service && export JAVA_HOME=$(/usr/libexec/java_home -v 21) && mvn -q spotless:check && mvn -q test)
bash infra/docker-compose/bootstrap.test.sh
bash scripts/ci/check-env-parity.sh && bash scripts/ci/check-env-leaks.sh && bash scripts/ci/check-dev-only.sh
git diff origin/main...feat/rtc-foundation --stat
```

Expected: tất cả PASS; diff chỉ chứa file của plan này (không có `scripts/dev/`, `compose.yml`, giá trị `localhost`).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/environments.md docs/superpowers/plans/README.md
git commit -m "docs: LiveKit ports, environments and plan status"
```
