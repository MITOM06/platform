package com.platform.chatservice.service;

import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.repository.CallSessionRepository;
import java.util.Optional;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * The one way to change a running {@link CallSession}. Reads it, applies the change, and writes it
 * back only if nobody else wrote in between (same {@code version}) and it is still running; on a
 * conflict it reads again and re-applies. Whole-document writes without that check lost concurrent
 * changes — a member joining (LiveKit webhook) while another accepted (STOMP) dropped one of them.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CallSessionWriter {

  private static final int ATTEMPTS = 5;

  private final CallSessionRepository sessions;
  private final MongoTemplate mongo;

  /**
   * Apply {@code change} to the running session {@code callId} and save it. {@code change} edits
   * the session it is given and returns false to write nothing; it may run more than once (once per
   * attempt), each time on a fresh copy. Empty when the call is gone or has ended, or when {@code
   * change} declined.
   */
  public Optional<CallSession> updateActive(String callId, Predicate<CallSession> change) {
    if (callId == null) {
      return Optional.empty();
    }
    for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
      CallSession session =
          sessions.findByCallId(callId).filter(s -> s.getEndedAt() == null).orElse(null);
      if (session == null || !change.test(session)) {
        return Optional.empty();
      }
      Long seen = session.getVersion();
      session.setVersion(seen == null ? 1L : seen + 1);
      // A null `seen` also matches sessions saved before the field existed.
      Query unchanged =
          new Query(
              Criteria.where("callId").is(callId).and("endedAt").is(null).and("version").is(seen));
      if (mongo.findAndReplace(unchanged, session) != null) {
        return Optional.of(session);
      }
    }
    log.warn("Call {}: gave up after {} conflicting writes", callId, ATTEMPTS);
    return Optional.empty();
  }
}
