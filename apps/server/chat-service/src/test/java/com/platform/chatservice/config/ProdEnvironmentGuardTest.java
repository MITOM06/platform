package com.platform.chatservice.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ProdEnvironmentGuardTest {

  private static final Map<String, String> PROD =
      Map.of(
          "spring.data.mongodb.uri",
          "mongodb+srv://user@cluster0.mongodb.net/platform",
          "spring.data.redis.url",
          "rediss://real-redis.upstash.io:6379",
          "spring.rabbitmq.host",
          "puffin.rmq2.cloudamqp.com");

  private static List<String> check(Map<String, String> env) {
    return ProdEnvironmentGuard.findProblems(env::get);
  }

  @Test
  @DisplayName("a fully external environment passes")
  void externalEnvironmentPasses() {
    assertThat(check(PROD)).isEmpty();
  }

  @Test
  @DisplayName("the application.yml localhost defaults are rejected, one message each")
  void localhostDefaultsRejected() {
    Map<String, String> dev =
        Map.of(
            "spring.data.mongodb.uri",
            "mongodb://localhost:27018/platform",
            "spring.data.redis.url",
            "redis://localhost:6379",
            "spring.rabbitmq.host",
            "localhost");
    assertThat(check(dev)).hasSize(3).allMatch(p -> p.contains("this container"));
  }

  @Test
  @DisplayName("a missing secret (empty env var) is reported, not silently accepted")
  void blankValueRejected() {
    Map<String, String> partial = new HashMap<>(PROD);
    partial.put("spring.rabbitmq.host", "");
    assertThat(check(partial))
        .singleElement()
        .asString()
        .contains("spring.rabbitmq.host is empty")
        .contains("SPRING_RABBITMQ_HOST");
  }

  @Test
  @DisplayName("an unresolvable property (null) is reported as empty rather than throwing")
  void nullValueRejected() {
    Map<String, String> partial = new HashMap<>(PROD);
    partial.remove("spring.data.mongodb.uri");
    assertThat(check(partial)).singleElement().asString().contains("SPRING_DATA_MONGODB_URI");
  }

  @Test
  @DisplayName("127.0.0.1 is caught too, not just the word localhost")
  void loopbackIpRejected() {
    Map<String, String> partial = new HashMap<>(PROD);
    partial.put("spring.data.redis.url", "redis://127.0.0.1:6379");
    assertThat(check(partial)).singleElement().asString().contains("127.0.0.1");
  }

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
            "app.livekit.api-secret", "0123456789abcdef0123456789abcdef");
    assertThat(liveKit(env)).isEmpty();
  }
}
