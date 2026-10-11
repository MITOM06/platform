package com.platform.chatservice.service;

import com.platform.chatservice.model.ExternalBot;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * Bookkeeping of the MCP tokens injected into members' Bot Factory assistants: which tokens are due
 * for renewal, and an atomic per-bot claim so only one instance renews each. Field-level updates
 * only, so a concurrent persona edit (which saves the whole record) is never overwritten.
 */
@Component
@RequiredArgsConstructor
public class AssistantTokenStore {

  /** A claim older than this was left by a crashed instance and may be taken over. */
  static final Duration CLAIM_TTL = Duration.ofMinutes(30);

  private static final String EXPIRES_AT = "mcpTokenExpiresAt";
  private static final String CLAIMED_AT = "mcpTokenRenewClaimedAt";

  private final MongoTemplate template;

  /**
   * Enabled assistants whose token expires within {@code renewBefore}, plus BotFather Zone
   * assistants set up before the expiry was recorded (persona and model mirrored, no expiry): their
   * token may already be close to its end. Admin-registered bots (no persona) are left alone, their
   * MCP wiring is not chat-service's.
   */
  public List<ExternalBot> dueForRenewal(Instant now, Duration renewBefore) {
    Criteria expiring = Criteria.where(EXPIRES_AT).lt(now.plus(renewBefore));
    Criteria legacy =
        new Criteria()
            .andOperator(
                Criteria.where(EXPIRES_AT).is(null),
                Criteria.where("systemPrompt").ne(null),
                Criteria.where("providerId").ne(null));
    Query query =
        new Query(
            new Criteria()
                .andOperator(
                    Criteria.where("enabled").is(true),
                    Criteria.where("factoryBotId").ne(null),
                    Criteria.where("ownerUserId").ne(null),
                    new Criteria().orOperator(expiring, legacy)));
    return template.find(query, ExternalBot.class);
  }

  /** Claim the renewal of one bot; false when another instance holds a fresh claim. */
  public boolean claim(String id, Instant now) {
    Query query =
        new Query(
            new Criteria()
                .andOperator(
                    Criteria.where("_id").is(id),
                    new Criteria()
                        .orOperator(
                            Criteria.where(CLAIMED_AT).is(null),
                            Criteria.where(CLAIMED_AT).lt(now.minus(CLAIM_TTL)))));
    return template
            .updateFirst(query, new Update().set(CLAIMED_AT, now), ExternalBot.class)
            .getModifiedCount()
        == 1;
  }

  /** Record a newly issued token's expiry and release any renewal claim. */
  public void recordIssued(String botUserId, Instant expiresAt) {
    template.updateFirst(
        Query.query(Criteria.where("botUserId").is(botUserId)),
        new Update().set(EXPIRES_AT, expiresAt).unset(CLAIMED_AT),
        ExternalBot.class);
  }
}
