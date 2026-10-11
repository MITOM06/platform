package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The MCP token chat-service injects into a member's Bot Factory assistant expires after
 * BOT_SESSION_TTL_DAYS (90) and was never re-issued: every assistant silently lost its PON tools
 * three months after setup. The store finds the assistants whose token is about to expire (and the
 * ones set up before the expiry was recorded) and lets exactly one instance renew each.
 */
@DataMongoTest
@Testcontainers
class AssistantTokenStoreTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  private static final Instant NOW = Instant.parse("2026-10-11T00:00:00Z");
  private static final Duration RENEW_BEFORE = Duration.ofDays(14);

  @Autowired private MongoTemplate template;
  @Autowired private ExternalBotRepository repository;
  private AssistantTokenStore store;

  @BeforeEach
  void setUp() {
    repository.deleteAll();
    store = new AssistantTokenStore(template);
  }

  private ExternalBot save(String id, Instant expiresAt, String prompt, boolean enabled) {
    return repository.save(
        ExternalBot.builder()
            .botUserId("extbot:" + id)
            .factoryBotId(id)
            .ownerUserId("owner-" + id)
            .name(id)
            .systemPrompt(prompt)
            .providerId(prompt == null ? null : "prov")
            .mcpTokenExpiresAt(expiresAt)
            .enabled(enabled)
            .build());
  }

  @Test
  void picksTokensExpiringSoonAndAssistantsWithoutARecordedExpiry() {
    save("soon", NOW.plus(Duration.ofDays(3)), "p", true);
    save("expired", NOW.minus(Duration.ofDays(1)), "p", true);
    save("legacy", null, "p", true);
    save("later", NOW.plus(Duration.ofDays(60)), "p", true);
    save("admin-registered", null, null, true);
    save("disabled", NOW.plus(Duration.ofDays(1)), "p", false);

    List<ExternalBot> due = store.dueForRenewal(NOW, RENEW_BEFORE);

    assertThat(due)
        .extracting(ExternalBot::getFactoryBotId)
        .containsExactlyInAnyOrder("soon", "expired", "legacy");
  }

  @Test
  void onlyOneInstanceClaimsARenewal() {
    ExternalBot bot = save("soon", NOW.plus(Duration.ofDays(3)), "p", true);

    assertThat(store.claim(bot.getId(), NOW)).isTrue();
    assertThat(store.claim(bot.getId(), NOW.plusSeconds(5))).isFalse();
    // A claim left behind by a crashed instance is taken over once it is stale.
    assertThat(store.claim(bot.getId(), NOW.plus(AssistantTokenStore.CLAIM_TTL).plusSeconds(1)))
        .isTrue();
  }

  @Test
  void recordingTheNewExpiryReleasesTheClaimAndTakesTheBotOffTheDueList() {
    ExternalBot bot = save("soon", NOW.plus(Duration.ofDays(3)), "p", true);
    store.claim(bot.getId(), NOW);

    store.recordIssued(bot.getBotUserId(), NOW.plus(Duration.ofDays(90)));

    ExternalBot after = repository.findById(bot.getId()).orElseThrow();
    assertThat(after.getMcpTokenExpiresAt()).isEqualTo(NOW.plus(Duration.ofDays(90)));
    assertThat(after.getMcpTokenRenewClaimedAt()).isNull();
    assertThat(store.dueForRenewal(NOW, RENEW_BEFORE)).isEmpty();
    // The rest of the record (persona, model) is untouched.
    assertThat(after.getSystemPrompt()).isEqualTo("p");
    assertThat(after.getProviderId()).isEqualTo("prov");
  }
}
