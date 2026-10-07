package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.meeting.CreateMeetingRequest;
import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.dto.meeting.MeetingResponse;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.dto.meeting.UpdateMeetingRequest;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.PageLimits;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Meeting lifecycle outside the room: create, read, list, edit, cancel. Capabilities and roles are
 * checked here (not with {@code @PreAuthorize}, which would surface as a 500) and every refusal is
 * an {@link ApiException} with a stable code. After the insert, writes go through {@link
 * MeetingStore} only.
 */
@Service
@RequiredArgsConstructor
public class MeetingService {

  static final String HOST_MEETING = "HOST_MEETING";
  static final int DEFAULT_PAGE_SIZE = 20;
  static final int CODE_ATTEMPTS = 5;

  private final MeetingStore store;
  private final MeetingCodeGenerator codes;
  private final MeetingPeople people;
  private final MeetingEvents events;
  private final MeetingMapper mapper;
  private final MeetingLobby lobby;
  private final MeetingRoomPolicy policy;

  /** {@code req} may be null: no body = an instant meeting with every default ("họp ngay"). */
  public MeetingResponse create(UserPrincipal caller, CreateMeetingRequest req) {
    if (!caller.hasPermission(HOST_MEETING)) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_CREATE_FORBIDDEN);
    }
    if (req == null) {
      req = new CreateMeetingRequest(null, null, null, null, null, null, null);
    }
    String hostId = caller.getUserId();
    Instant now = Instant.now();
    String title = MeetingRequests.title(req.title());
    String description = MeetingRequests.description(req.description());
    List<String> invitees = MeetingRequests.invitees(req.inviteeIds(), hostId);
    MeetingRequests.schedule(req.scheduledStart(), req.scheduledEnd(), now);
    Meeting.Settings settings = MeetingRequests.settings(req.settings(), null);
    String departmentId = blankToNull(req.departmentId());
    MeetingRequests.department(caller, departmentId);
    invitees = existing(invitees);

    Meeting saved = null;
    for (int attempt = 0; attempt < CODE_ATTEMPTS && saved == null; attempt++) {
      Meeting m =
          Meeting.builder()
              .code(codes.next())
              .title(title)
              .description(description)
              .hostId(hostId)
              .inviteeIds(new ArrayList<>(invitees))
              .departmentId(departmentId)
              .scheduledStart(req.scheduledStart())
              .scheduledEnd(req.scheduledEnd())
              .sortAt(req.scheduledStart() != null ? req.scheduledStart() : now)
              .status(MeetingStatus.SCHEDULED)
              .settings(settings)
              .attendance(new ArrayList<>())
              .createdAt(now)
              .build();
      try {
        saved = store.insert(m);
      } catch (DuplicateKeyException e) {
        // Code collision (≈1 in 4·10^13) — try again with a fresh one.
      }
    }
    if (saved == null) {
      throw new IllegalStateException("Could not allocate a unique meeting code");
    }
    if (!invitees.isEmpty()) {
      events.invited(saved, hostName(saved), invitees);
    }
    return mapper.toResponse(saved, "host");
  }

  public MeetingResponse get(UserPrincipal caller, String id) {
    return view(caller, find(id));
  }

  public MeetingResponse getByCode(UserPrincipal caller, String rawCode) {
    String code = MeetingCodeGenerator.normalize(rawCode);
    if (code == null) {
      throw notFound();
    }
    return view(caller, store.findByCode(code).orElseThrow(MeetingService::notFound));
  }

  public PageResponse<MeetingResponse> list(
      UserPrincipal caller, String scope, String cursor, int size) {
    boolean upcoming;
    if (scope == null || scope.isBlank() || "upcoming".equals(scope)) {
      upcoming = true;
    } else if ("past".equals(scope)) {
      upcoming = false;
    } else {
      throw MeetingRequests.invalid("scope");
    }
    int limit = PageLimits.size(size, DEFAULT_PAGE_SIZE);
    Meeting after = null;
    if (cursor != null && !cursor.isBlank()) {
      after = store.findById(cursor).orElse(null);
      if (after == null) {
        return new PageResponse<>(List.of(), 0, limit, 0);
      }
    }
    List<Meeting> rows =
        store.page(caller.getUserId(), caller.getDepts(), upcoming, after, limit + 1);
    boolean hasMore = rows.size() > limit;
    List<MeetingResponse> content =
        mapper.toResponses(
            rows.stream().limit(limit).toList(),
            m -> MeetingAccess.viewerRole(m, caller.getUserId(), caller.getDepts()));
    return new PageResponse<>(content, 0, limit, hasMore ? limit + 1 : content.size());
  }

  public MeetingResponse update(UserPrincipal caller, String id, UpdateMeetingRequest req) {
    Meeting m = find(id);
    if (!MeetingAccess.canManage(m, caller.getUserId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_FORBIDDEN);
    }
    if (m.getStatus() == MeetingStatus.ENDED) {
      throw ended();
    }

    Update update = new Update();
    boolean changed = false;
    if (req.title() != null) {
      setOrUnset(update, "title", MeetingRequests.title(req.title()));
      changed = true;
    }
    if (req.description() != null) {
      setOrUnset(update, "description", MeetingRequests.description(req.description()));
      changed = true;
    }
    List<String> newcomers = List.of();
    if (req.inviteeIds() != null) {
      List<String> invitees = existing(MeetingRequests.invitees(req.inviteeIds(), m.getHostId()));
      update.set("inviteeIds", invitees);
      List<String> before = m.getInviteeIds() == null ? List.of() : m.getInviteeIds();
      newcomers = invitees.stream().filter(u -> !before.contains(u)).toList();
      changed = true;
    }
    String departmentId = blankToNull(req.departmentId());
    if (req.departmentId() != null && !Objects.equals(departmentId, m.getDepartmentId())) {
      // Only a change is checked: a co-host outside the department may still edit the rest.
      MeetingRequests.department(caller, departmentId);
      setOrUnset(update, "departmentId", departmentId);
      changed = true;
    }
    changed |= reschedule(m, req, update);
    boolean settingsChanged = false;
    if (req.settings() != null) {
      Meeting.Settings merged = MeetingRequests.settings(req.settings(), m.getSettings());
      update.set("settings", merged);
      settingsChanged = !Objects.equals(merged, m.getSettings());
      changed = true;
    }
    if (!changed) {
      // An empty update document would make findAndModify replace the whole meeting.
      return view(caller, m);
    }

    Meeting updated = store.update(id, update).orElseThrow(MeetingService::ended);
    if (settingsChanged) {
      events.settings(updated);
      policy.afterSettingsChange(m, updated);
    }
    if (!newcomers.isEmpty()) {
      events.invited(updated, hostName(updated), newcomers);
    }
    return view(caller, updated);
  }

  public void cancel(UserPrincipal caller, String id) {
    Meeting m = find(id);
    if (!Objects.equals(m.getHostId(), caller.getUserId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_FORBIDDEN);
    }
    if (!store.markCancelled(id, Instant.now())) {
      throw new ApiException(HttpStatus.CONFLICT, ErrorCodes.MEETING_NOT_CANCELLABLE);
    }
    // A cancelled meeting is ENDED: like MeetingCloser, release whoever is still in the lobby.
    List<String> waiting = lobby.waiting(id).stream().map(LobbyEntryDto::userId).toList();
    lobby.clear(id);
    events.ended(id, waiting);
    List<String> recipients =
        new ArrayList<>(
            MeetingMapper.recipients(
                m,
                m.getDepartmentId() == null
                    ? List.of()
                    : people.departmentMembers(m.getDepartmentId())));
    recipients.remove(caller.getUserId());
    events.cancelled(id, recipients);
  }

  /** Applies a schedule change; a LIVE meeting keeps its schedule. True when something changed. */
  private static boolean reschedule(Meeting m, UpdateMeetingRequest req, Update update) {
    Instant start = req.scheduledStart();
    Instant end = req.scheduledEnd();
    if (start == null && end == null) {
      return false;
    }
    if (m.getStatus() == MeetingStatus.LIVE) {
      throw MeetingRequests.invalid("scheduledStart");
    }
    Instant effectiveEnd = end != null ? end : m.getScheduledEnd();
    if (start != null) {
      MeetingRequests.schedule(start, effectiveEnd, Instant.now());
      update.set("scheduledStart", start).set("sortAt", start).set("reminded", false);
    } else {
      MeetingRequests.end(m.getScheduledStart(), end);
    }
    if (end != null) {
      update.set("scheduledEnd", end);
    }
    return true;
  }

  private MeetingResponse view(UserPrincipal caller, Meeting m) {
    return mapper.toResponse(m, MeetingAccess.viewerRole(m, caller.getUserId(), caller.getDepts()));
  }

  private Meeting find(String id) {
    if (id == null || id.isBlank()) {
      throw notFound();
    }
    return store.findById(id).orElseThrow(MeetingService::notFound);
  }

  /** {@code ids} restricted to real users, order kept. */
  private List<String> existing(List<String> ids) {
    if (ids.isEmpty()) {
      return ids;
    }
    Set<String> known = people.existingUserIds(ids);
    return ids.stream().filter(known::contains).toList();
  }

  private String hostName(Meeting m) {
    PersonDto host = MeetingMapper.person(m.getHostId(), people.profiles(hostOnly(m)));
    return host.displayName();
  }

  private static Collection<String> hostOnly(Meeting m) {
    return m.getHostId() == null ? List.of() : List.of(m.getHostId());
  }

  private static void setOrUnset(Update update, String field, Object value) {
    if (value == null) {
      update.unset(field);
    } else {
      update.set(field, value);
    }
  }

  private static String blankToNull(String s) {
    return s == null || s.isBlank() ? null : s;
  }

  static ApiException notFound() {
    return new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.MEETING_NOT_FOUND);
  }

  static ApiException ended() {
    return new ApiException(HttpStatus.CONFLICT, ErrorCodes.MEETING_ENDED);
  }
}
