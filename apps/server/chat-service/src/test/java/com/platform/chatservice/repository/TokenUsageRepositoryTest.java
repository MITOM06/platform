package com.platform.chatservice.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.model.TokenUsage;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Integration test for {@link TokenUsageRepository#findUsageInRange}. Runs against a real MongoDB
 * because the bug was in how the query is translated: the derived {@code DateBetween} is exclusive
 * on both ends, so the personal token-usage dashboard ("last N days", ending today) always showed
 * today as 0 and a custom range lost its first and last day.
 */
@DataMongoTest
@Testcontainers
class TokenUsageRepositoryTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private TokenUsageRepository repository;

  @BeforeEach
  void seed() {
    repository.deleteAll();
    for (String date : List.of("2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01")) {
      repository.save(
          TokenUsage.builder()
              .userId("user-a")
              .date(date)
              .inputTokens(100)
              .outputTokens(10)
              .requestCount(1)
              .build());
    }
    repository.save(
        TokenUsage.builder().userId("user-b").date("2026-09-30").inputTokens(999).build());
  }

  @Test
  void includesBothEndsOfTheRange() {
    List<TokenUsage> rows = repository.findUsageInRange("user-a", "2026-09-29", "2026-09-30");

    assertThat(rows).extracting(TokenUsage::getDate).containsExactly("2026-09-29", "2026-09-30");
  }

  @Test
  void singleDayRangeReturnsThatDay() {
    List<TokenUsage> rows = repository.findUsageInRange("user-a", "2026-09-30", "2026-09-30");

    assertThat(rows).extracting(TokenUsage::getDate).containsExactly("2026-09-30");
  }

  @Test
  void onlyReturnsTheRequestedUserSortedByDate() {
    List<TokenUsage> rows = repository.findUsageInRange("user-a", "2026-09-01", "2026-10-31");

    assertThat(rows)
        .extracting(TokenUsage::getDate)
        .containsExactly("2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01");
    assertThat(rows).allMatch(r -> r.getUserId().equals("user-a"));
  }
}
