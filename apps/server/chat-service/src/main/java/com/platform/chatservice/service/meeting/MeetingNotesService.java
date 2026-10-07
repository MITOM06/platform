package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.MeetingNoteDto;
import com.platform.chatservice.dto.meeting.MeetingNoteRequest;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.MeetingNoteConflictException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingNote;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The shared note of a meeting and each person's private note ({@code meeting_notes}), with
 * optimistic locking: a save names the {@code version} it was made on; a stale version is 409
 * {@code MEETING_NOTE_CONFLICT} carrying the current note, and nothing changes. Writes are a
 * conditional insert (first save, guarded by the unique {@code {meetingId, scope, ownerId}} index)
 * or a conditional {@code findAndModify} on the version — never read-modify-write.
 *
 * <p>Notes stay readable and editable after the meeting ended; removed people lose them.
 */
@Service
@RequiredArgsConstructor
public class MeetingNotesService {

  static final int CONTENT_MAX = 50_000;

  /** Which note: the meeting's shared one, or the caller's own private one. */
  public enum Scope {
    SHARED("shared"),
    PRIVATE("private");

    private final String wire;

    Scope(String wire) {
      this.wire = wire;
    }

    /** The JSON value ({@code shared | private}); Mongo stores {@link #name()}. */
    public String wire() {
      return wire;
    }
  }

  private final MongoTemplate mongo;
  private final MeetingGuard guard;
  private final MeetingPeople people;
  private final MeetingEvents events;

  /** The note, or {@code {content: "", version: 0}} when nobody wrote it yet. */
  public MeetingNoteDto get(UserPrincipal caller, String meetingId, Scope scope) {
    guard.records(caller, meetingId);
    return current(meetingId, scope, caller.getUserId());
  }

  /**
   * Saves the note on top of {@code req.version()} and returns it with the bumped version. The
   * shared note announces {@code meet.notes.updated} (version + who, never the text) until the
   * meeting ended; a private note announces nothing.
   */
  public MeetingNoteDto put(
      UserPrincipal caller, String meetingId, Scope scope, MeetingNoteRequest req) {
    Meeting m = guard.records(caller, meetingId);
    String uid = caller.getUserId();
    if (scope == Scope.SHARED
        && !MeetingAccess.canEditSharedNote(
            m, uid, caller.getDepts(), guard.admitted(meetingId, uid))) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_NOTES_READ_ONLY);
    }
    if (req == null || req.content() == null) {
      throw MeetingRequests.invalid("content");
    }
    if (req.content().length() > CONTENT_MAX) {
      throw MeetingRequests.invalid("content", CONTENT_MAX);
    }
    if (req.version() == null || req.version() < 0) {
      throw MeetingRequests.invalid("version");
    }

    Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    String ownerId = owner(scope, uid);
    MeetingNote saved;
    if (req.version() == 0) {
      try {
        saved =
            mongo.insert(
                MeetingNote.builder()
                    .meetingId(meetingId)
                    .scope(scope.name())
                    .ownerId(ownerId)
                    .content(req.content())
                    .version(1)
                    .updatedBy(uid)
                    .updatedAt(now)
                    .build());
      } catch (DuplicateKeyException e) {
        // Someone created the note first: the caller's base (version 0) is stale.
        throw new MeetingNoteConflictException(current(meetingId, scope, uid));
      }
    } else {
      Query query = noteQuery(meetingId, scope, ownerId);
      query.addCriteria(Criteria.where("version").is(req.version()));
      saved =
          mongo.findAndModify(
              query,
              new Update()
                  .set("content", req.content())
                  .set("updatedBy", uid)
                  .set("updatedAt", now)
                  .inc("version", 1),
              FindAndModifyOptions.options().returnNew(true),
              MeetingNote.class);
      if (saved == null) {
        throw new MeetingNoteConflictException(current(meetingId, scope, uid));
      }
    }

    MeetingNoteDto dto = toDto(scope, saved);
    // Once ENDED nobody is in the room, and a removed person's old subscription may still be open
    // (the removed set is cleared at the end): announce nothing.
    if (scope == Scope.SHARED && m.getStatus() != MeetingStatus.ENDED) {
      events.notesUpdated(meetingId, dto.version(), dto.updatedBy());
    }
    return dto;
  }

  private MeetingNoteDto current(String meetingId, Scope scope, String uid) {
    MeetingNote note =
        mongo.findOne(noteQuery(meetingId, scope, owner(scope, uid)), MeetingNote.class);
    if (note == null) {
      return new MeetingNoteDto(scope.wire(), "", 0, null, null);
    }
    return toDto(scope, note);
  }

  private MeetingNoteDto toDto(Scope scope, MeetingNote note) {
    PersonDto updatedBy = null;
    if (note.getUpdatedBy() != null) {
      Map<String, PersonDto> profiles = people.profiles(List.of(note.getUpdatedBy()));
      updatedBy = MeetingMapper.person(note.getUpdatedBy(), profiles);
    }
    String content = note.getContent() == null ? "" : note.getContent();
    return new MeetingNoteDto(
        scope.wire(), content, note.getVersion(), updatedBy, note.getUpdatedAt());
  }

  private static Query noteQuery(String meetingId, Scope scope, String ownerId) {
    // ownerId null matches the SHARED note, whose ownerId field is absent.
    return new Query(
        Criteria.where("meetingId")
            .is(meetingId)
            .and("scope")
            .is(scope.name())
            .and("ownerId")
            .is(ownerId));
  }

  private static String owner(Scope scope, String uid) {
    return scope == Scope.PRIVATE ? uid : null;
  }
}
