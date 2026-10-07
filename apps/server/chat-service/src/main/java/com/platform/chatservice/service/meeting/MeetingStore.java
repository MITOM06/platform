package com.platform.chatservice.service.meeting;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.repository.MeetingRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * Every write to a {@link Meeting} after its first insert, each one a single atomic Mongo update.
 *
 * <p>LiveKit webhooks for many participants land concurrently; a read-modify-write of the whole
 * document would drop attendance rows. Never {@code repository.save(meeting)} an existing meeting —
 * add a method here instead.
 */
@Component
@RequiredArgsConstructor
public class MeetingStore {

  private final MongoTemplate mongo;
  private final MeetingRepository repository;

  /**
   * First write of a new meeting. A duplicate {@code code} throws {@code DuplicateKeyException}.
   */
  public Meeting insert(Meeting m) {
    if (m.getAttendance() == null) {
      // markEnded's `attendance.$[open]` needs the array to exist.
      m.setAttendance(new ArrayList<>());
    }
    return repository.insert(m);
  }

  public Optional<Meeting> findById(String id) {
    return repository.findById(id);
  }

  public Optional<Meeting> findByCode(String code) {
    return repository.findByCode(code);
  }

  /** Applies {@code update} unless the meeting is ENDED; returns the new state, empty otherwise. */
  public Optional<Meeting> update(String id, Update update) {
    Query query = new Query(byId(id).and("status").ne(MeetingStatus.ENDED));
    return Optional.ofNullable(
        mongo.findAndModify(
            query, update, FindAndModifyOptions.options().returnNew(true), Meeting.class));
  }

  /** SCHEDULED ⇒ LIVE once; true only for the call that flipped it. */
  public boolean markLive(String id, Instant at) {
    Query query = new Query(byId(id).and("status").is(MeetingStatus.SCHEDULED));
    Update update = new Update().set("status", MeetingStatus.LIVE).set("startedAt", at);
    return mongo.updateFirst(query, update, Meeting.class).getModifiedCount() > 0;
  }

  /**
   * Records a {@code participant_joined}. If the person already has an open row (a second device /
   * a reconnect, or the same webhook delivered twice) only its sid is replaced; otherwise a new row
   * is appended — conditionally, so two racing deliveries for the same person cannot open two rows.
   *
   * <p>Never writes to an ENDED meeting: a join webhook racing {@code end} would otherwise leave an
   * open row nobody ever closes. True when the row was recorded (appended or its sid replaced).
   */
  public boolean recordJoin(String id, Meeting.Attendance row) {
    for (int attempt = 0; attempt < 2; attempt++) {
      Query open = new Query(notEnded(id).and("attendance").elemMatch(openRowOf(row.getUserId())));
      if (mongo
              .updateFirst(open, new Update().set("attendance.$.sid", row.getSid()), Meeting.class)
              .getMatchedCount()
          > 0) {
        return true;
      }
      Query noOpenRow =
          new Query(notEnded(id).and("attendance").not().elemMatch(openRowOf(row.getUserId())));
      if (mongo
              .updateFirst(noOpenRow, new Update().push("attendance", row), Meeting.class)
              .getMatchedCount()
          > 0) {
        return true;
      }
      // The meeting is gone or ENDED, or another delivery opened the row in between — retry the
      // sid replacement once.
    }
    return false;
  }

  private static Criteria notEnded(String id) {
    return byId(id).and("status").ne(MeetingStatus.ENDED);
  }

  /**
   * Closes the open row of {@code userId} for session {@code sid} (any open row when {@code sid} is
   * null). A stale session leaving never closes the person's newer session.
   */
  public boolean recordLeave(String id, String userId, String sid, Instant at) {
    Criteria row = openRowOf(userId);
    if (sid != null) {
      row = row.and("sid").is(sid);
    }
    Query query = new Query(byId(id).and("attendance").elemMatch(row));
    return mongo
            .updateFirst(query, new Update().set("attendance.$.leftAt", at), Meeting.class)
            .getModifiedCount()
        > 0;
  }

  /**
   * Ends the meeting once, closing every open attendance row at {@code at}. Returns the state
   * <em>before</em> the change (to know who was still in the room); empty when already ENDED.
   */
  public Optional<Meeting> markEnded(String id, Instant at) {
    Query query = new Query(byId(id).and("status").ne(MeetingStatus.ENDED));
    Update update =
        new Update()
            .set("status", MeetingStatus.ENDED)
            .set("endedAt", at)
            .set("attendance.$[open].leftAt", at)
            .filterArray(Criteria.where("open.leftAt").is(null));
    return Optional.ofNullable(
        mongo.findAndModify(
            query, update, FindAndModifyOptions.options().returnNew(false), Meeting.class));
  }

  /** Cancels a SCHEDULED meeting nobody ever entered; false otherwise. */
  public boolean markCancelled(String id, Instant at) {
    Query query =
        new Query(
            byId(id)
                .and("status")
                .is(MeetingStatus.SCHEDULED)
                .and("startedAt")
                .is(null)
                .and("attendance")
                .size(0));
    Update update =
        new Update().set("status", MeetingStatus.ENDED).set("endedAt", at).set("cancelledAt", at);
    return mongo.updateFirst(query, update, Meeting.class).getModifiedCount() > 0;
  }

  /**
   * Meetings whose start is within {@code lead} of {@code now} and not reminded yet. LIVE is
   * included: a host opening the room early must not swallow everyone else's reminder.
   */
  public List<Meeting> dueForReminder(Instant now, Duration lead) {
    Query query =
        new Query(
            Criteria.where("status")
                .in(MeetingStatus.SCHEDULED, MeetingStatus.LIVE)
                .and("reminded")
                .is(false)
                .and("scheduledStart")
                .gte(now.minus(lead))
                .lte(now.plus(lead)));
    return mongo.find(query, Meeting.class);
  }

  /** Claims the reminder for this instance; true exactly once across the cluster. */
  public boolean claimReminder(String id) {
    Query query = new Query(byId(id).and("reminded").is(false));
    return mongo
            .updateFirst(query, new Update().set("reminded", true), Meeting.class)
            .getModifiedCount()
        > 0;
  }

  /** Ends every SCHEDULED meeting whose {@code sortAt} is before {@code cutoff}. */
  public long expireStale(Instant cutoff, Instant at) {
    Query query =
        new Query(Criteria.where("status").is(MeetingStatus.SCHEDULED).and("sortAt").lt(cutoff));
    Update update = new Update().set("status", MeetingStatus.ENDED).set("endedAt", at);
    return mongo.updateMulti(query, update, Meeting.class).getModifiedCount();
  }

  /**
   * One page of the caller's meetings — host, co-host, invited by name, or in the meeting's
   * department. Upcoming = SCHEDULED/LIVE ascending by {@code (sortAt, _id)}; past = ENDED
   * descending. {@code cursor} is the last meeting of the previous page.
   */
  public List<Meeting> page(
      String userId, Collection<String> depts, boolean upcoming, Meeting cursor, int limit) {
    List<Criteria> mine = new ArrayList<>();
    mine.add(Criteria.where("hostId").is(userId));
    mine.add(Criteria.where("coHostIds").is(userId));
    mine.add(Criteria.where("inviteeIds").is(userId));
    if (depts != null && !depts.isEmpty()) {
      mine.add(Criteria.where("departmentId").in(depts));
    }

    List<Criteria> ands = new ArrayList<>();
    ands.add(new Criteria().orOperator(mine.toArray(new Criteria[0])));
    ands.add(
        upcoming
            ? Criteria.where("status").in(MeetingStatus.SCHEDULED, MeetingStatus.LIVE)
            : Criteria.where("status").is(MeetingStatus.ENDED));

    if (cursor != null) {
      if (cursor.getSortAt() == null || cursor.getId() == null) {
        // Incomplete cursor — an empty page rather than the whole list again.
        return List.of();
      }
      Instant at = cursor.getSortAt();
      // _id compares by its stored BSON type: ObjectId in prod (24-hex ids), String otherwise.
      Object cursorId =
          ObjectId.isValid(cursor.getId()) ? new ObjectId(cursor.getId()) : cursor.getId();
      ands.add(
          upcoming
              ? new Criteria()
                  .orOperator(
                      Criteria.where("sortAt").gt(at),
                      new Criteria()
                          .andOperator(
                              Criteria.where("sortAt").is(at), Criteria.where("_id").gt(cursorId)))
              : new Criteria()
                  .orOperator(
                      Criteria.where("sortAt").lt(at),
                      new Criteria()
                          .andOperator(
                              Criteria.where("sortAt").is(at),
                              Criteria.where("_id").lt(cursorId))));
    }

    Sort.Direction dir = upcoming ? Sort.Direction.ASC : Sort.Direction.DESC;
    Query query =
        new Query(new Criteria().andOperator(ands.toArray(new Criteria[0])))
            .with(Sort.by(dir, "sortAt").and(Sort.by(dir, "_id")))
            .limit(limit);
    return mongo.find(query, Meeting.class);
  }

  private static Criteria byId(String id) {
    return Criteria.where("_id").is(id);
  }

  private static Criteria openRowOf(String userId) {
    return Criteria.where("userId").is(userId).and("leftAt").is(null);
  }
}
