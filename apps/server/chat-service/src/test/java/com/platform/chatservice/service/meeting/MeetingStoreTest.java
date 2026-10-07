package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.repository.MeetingRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingStoreTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  @Autowired private MongoMappingContext mappingContext;
  @Autowired private MeetingRepository repository;
  private MeetingStore store;
  private final Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

  @BeforeEach
  void setUp() {
    repository.deleteAll();
    IndexOperations ops = template.indexOps(Meeting.class);
    new MongoPersistentEntityIndexResolver(mappingContext)
        .resolveIndexFor(Meeting.class)
        .forEach(ops::ensureIndex);
    store = new MeetingStore(template, repository);
  }

  private Meeting meeting(String code, Instant sortAt, String... invitees) {
    return store.insert(
        Meeting.builder()
            .code(code)
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of(invitees)))
            .sortAt(sortAt)
            .createdAt(now)
            .build());
  }

  private static Meeting.Attendance row(String userId, String sid) {
    return Meeting.Attendance.builder()
        .userId(userId)
        .role("attendee")
        .sid(sid)
        .joinedAt(Instant.now())
        .build();
  }

  private Meeting reload(Meeting m) {
    return store.findById(m.getId()).orElseThrow();
  }

  @Test
  void codesAreUnique() {
    meeting("abc-defg-hjk", now);
    assertThatThrownBy(() -> meeting("abc-defg-hjk", now))
        .isInstanceOf(DuplicateKeyException.class);
    assertThat(store.findByCode("abc-defg-hjk")).isPresent();
  }

  @Test
  void concurrentJoinsAllLand() throws Exception {
    Meeting m = meeting("aaa-aaaa-aaa", now);
    ExecutorService pool = Executors.newFixedThreadPool(8);
    for (int i = 0; i < 20; i++) {
      String user = "u" + i;
      pool.submit(() -> store.recordJoin(m.getId(), row(user, "PA_" + user)));
    }
    pool.shutdown();
    assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

    assertThat(reload(m).getAttendance()).hasSize(20);
  }

  @Test
  void aSecondSessionOfTheSamePersonReplacesTheSidAndAReplayAddsNothing() {
    Meeting m = meeting("bbb-bbbb-bbb", now);
    store.recordJoin(m.getId(), row("u1", "PA_OLD"));
    store.recordJoin(m.getId(), row("u1", "PA_NEW"));
    store.recordJoin(m.getId(), row("u1", "PA_NEW")); // webhook delivered twice

    assertThat(reload(m).getAttendance())
        .singleElement()
        .satisfies(a -> assertThat(a.getSid()).isEqualTo("PA_NEW"));
  }

  @Test
  void aStaleSessionLeavingDoesNotCloseTheNewOne() {
    Meeting m = meeting("ccc-cccc-ccc", now);
    store.recordJoin(m.getId(), row("u1", "PA_OLD"));
    store.recordJoin(m.getId(), row("u1", "PA_NEW"));

    assertThat(store.recordLeave(m.getId(), "u1", "PA_OLD", now)).isFalse();
    assertThat(reload(m).getAttendance().get(0).getLeftAt()).isNull();

    assertThat(store.recordLeave(m.getId(), "u1", "PA_NEW", now)).isTrue();
    assertThat(reload(m).getAttendance().get(0).getLeftAt()).isEqualTo(now);
  }

  @Test
  void comingBackAfterLeavingOpensANewRow() {
    Meeting m = meeting("ddd-dddd-ddd", now);
    store.recordJoin(m.getId(), row("u1", "PA_1"));
    store.recordLeave(m.getId(), "u1", "PA_1", now);
    store.recordJoin(m.getId(), row("u1", "PA_2"));

    assertThat(reload(m).getAttendance()).hasSize(2);
    assertThat(reload(m).getAttendance().get(1).getLeftAt()).isNull();
  }

  @Test
  void liveOnlyOnceAndEndedOnlyOnce() {
    Meeting m = meeting("eee-eeee-eee", now);
    store.recordJoin(m.getId(), row("u1", "PA_1"));
    store.recordJoin(m.getId(), row("u2", "PA_2"));
    store.recordLeave(m.getId(), "u2", "PA_2", now.minusSeconds(60));

    assertThat(store.markLive(m.getId(), now)).isTrue();
    assertThat(store.markLive(m.getId(), now.plusSeconds(5))).isFalse();
    assertThat(reload(m).getStartedAt()).isEqualTo(now);

    Instant end = now.plusSeconds(600);
    Meeting before = store.markEnded(m.getId(), end).orElseThrow();
    assertThat(before.getStatus()).isEqualTo(MeetingStatus.LIVE);
    assertThat(before.getAttendance().stream().filter(a -> a.getLeftAt() == null))
        .extracting(Meeting.Attendance::getUserId)
        .containsExactly("u1");

    Meeting after = reload(m);
    assertThat(after.getStatus()).isEqualTo(MeetingStatus.ENDED);
    assertThat(after.getEndedAt()).isEqualTo(end);
    assertThat(after.getAttendance()).allSatisfy(a -> assertThat(a.getLeftAt()).isNotNull());
    assertThat(after.getAttendance().get(1).getLeftAt()).isEqualTo(now.minusSeconds(60));

    assertThat(store.markEnded(m.getId(), end.plusSeconds(1))).isEmpty();
    assertThat(store.update(m.getId(), new Update().set("title", "x"))).isEmpty();
  }

  @Test
  void aJoinArrivingAfterTheEndIsRefused() {
    Meeting m = meeting("hhh-hhhh-hhh", now);
    assertThat(store.recordJoin(m.getId(), row("u1", "PA_1"))).isTrue();
    assertThat(store.recordJoin(m.getId(), row("u1", "PA_2"))).isTrue(); // sid replaced
    store.markEnded(m.getId(), now);

    assertThat(store.recordJoin(m.getId(), row("u2", "PA_3"))).isFalse();
    assertThat(store.recordJoin(m.getId(), row("u1", "PA_4"))).isFalse();
    assertThat(reload(m).getAttendance())
        .singleElement()
        .satisfies(
            a -> {
              assertThat(a.getUserId()).isEqualTo("u1");
              assertThat(a.getSid()).isEqualTo("PA_2");
              assertThat(a.getLeftAt()).isEqualTo(now);
            });
  }

  @Test
  void onlyAMeetingNobodyEverJoinedCanBeCancelled() {
    Meeting quiet = meeting("fff-ffff-fff", now);
    Meeting used = meeting("ggg-gggg-ggg", now);
    store.recordJoin(used.getId(), row("u1", "PA_1"));

    assertThat(store.markCancelled(used.getId(), now)).isFalse();
    assertThat(store.markCancelled(quiet.getId(), now)).isTrue();
    assertThat(reload(quiet).getCancelledAt()).isEqualTo(now);
    assertThat(reload(quiet).getStatus()).isEqualTo(MeetingStatus.ENDED);
    assertThat(store.markCancelled(quiet.getId(), now)).isFalse();
  }

  @Test
  void remindersAreDueInTheWindowAndClaimedOnce() {
    Meeting soon = meeting("hhh-hhhh-hhh", now);
    store.update(soon.getId(), new Update().set("scheduledStart", now.plusSeconds(300)));
    Meeting later = meeting("jjj-jjjj-jjj", now);
    store.update(later.getId(), new Update().set("scheduledStart", now.plusSeconds(3600)));

    assertThat(store.dueForReminder(now, Duration.ofMinutes(10)))
        .extracting(Meeting::getId)
        .containsExactly(soon.getId());
    assertThat(store.claimReminder(soon.getId())).isTrue();
    assertThat(store.claimReminder(soon.getId())).isFalse();
    assertThat(store.dueForReminder(now, Duration.ofMinutes(10))).isEmpty();
  }

  @Test
  void staleScheduledMeetingsExpire() {
    Meeting old = meeting("kkk-kkkk-kkk", now.minus(Duration.ofHours(49)));
    Meeting fresh = meeting("mmm-mmmm-mmm", now.minus(Duration.ofHours(1)));

    assertThat(store.expireStale(now.minus(Duration.ofHours(48)), now)).isEqualTo(1);
    assertThat(reload(old).getStatus()).isEqualTo(MeetingStatus.ENDED);
    assertThat(reload(fresh).getStatus()).isEqualTo(MeetingStatus.SCHEDULED);
  }

  @Test
  void pagesListOnlyMyMeetingsInOrderWithACursor() {
    Meeting a = meeting("nnn-nnnn-nnn", now.plusSeconds(10), "me");
    Meeting b = meeting("ppp-pppp-ppp", now.plusSeconds(20));
    store.update(b.getId(), new Update().set("departmentId", "dept-a"));
    Meeting c = meeting("qqq-qqqq-qqq", now.plusSeconds(30));
    store.update(c.getId(), new Update().set("coHostIds", List.of("me")));
    meeting("rrr-rrrr-rrr", now.plusSeconds(40), "someone-else");
    Meeting ended = meeting("sss-ssss-sss", now.plusSeconds(5), "me");
    store.markEnded(ended.getId(), now);

    List<Meeting> first = store.page("me", List.of("dept-a"), true, null, 2);
    assertThat(first).extracting(Meeting::getId).containsExactly(a.getId(), b.getId());
    List<Meeting> second = store.page("me", List.of("dept-a"), true, first.get(1), 2);
    assertThat(second).extracting(Meeting::getId).containsExactly(c.getId());

    assertThat(store.page("me", List.of(), false, null, 10))
        .extracting(Meeting::getId)
        .containsExactly(ended.getId());
    assertThat(store.page("me", List.of(), true, null, 10))
        .extracting(Meeting::getId)
        .containsExactly(a.getId(), c.getId()); // no department ⇒ b is not mine
  }
}
