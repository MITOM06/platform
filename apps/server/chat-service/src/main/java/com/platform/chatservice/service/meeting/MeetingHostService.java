package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.MeetingHostCommand;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Host / co-host commands sent on {@code /app/meet.host} ({@link MeetingHostAction}). An attendee
 * sending one (a forged client) is ignored and logged — no LiveKit call, no event, no error. Every
 * other refusal is an {@link ApiException} the STOMP controller turns into {@code meet.error}.
 * LiveKit is only reached through {@link MeetingRoomPolicy}; state already saved in Mongo / Redis
 * stays when LiveKit then fails (re-sending the command is idempotent).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MeetingHostService {

  private static final String COHOSTS = "coHostIds";

  private final MeetingGuard guard;
  private final MeetingStore store;
  private final MeetingLobby lobby;
  private final MeetingHandService hands;
  private final MeetingRoomPolicy policy;
  private final MeetingPeople people;
  private final MeetingEvents events;

  public void execute(UserPrincipal caller, MeetingHostCommand cmd) {
    MeetingHostAction action =
        MeetingHostAction.parse(cmd == null ? null : cmd.action())
            .orElseThrow(() -> MeetingRequests.invalid("action"));
    Meeting m = guard.find(cmd.meetingId());
    if (m.getStatus() == MeetingStatus.ENDED) {
      throw MeetingService.ended();
    }
    String uid = caller.getUserId();
    if (!MeetingAccess.canManage(m, uid)) {
      log.warn("Ignored meeting host command {} from a non-manager", action);
      return;
    }
    String target = cmd.targetId();
    if (action.needsTarget() && (target == null || target.isBlank())) {
      throw MeetingRequests.invalid("targetId");
    }
    String id = m.getId();
    switch (action) {
      case MUTE_MIC -> mute(id, uid, target::equals);
      case MUTE_ALL -> mute(id, uid, who -> !who.equals(uid));
      case REMOVE -> remove(m, uid, target);
      case LOWER_HAND -> hands.lower(id, target);
      case LOWER_ALL_HANDS -> hands.lowerAll(id);
      case LOCK -> setting(m, "settings.locked", true);
      case UNLOCK -> setting(m, "settings.locked", false);
      case WAITING_ROOM_ON -> setting(m, "settings.waitingRoom", true);
      case WAITING_ROOM_OFF -> setting(m, "settings.waitingRoom", false);
      case ATTENDEE_SCREEN_SHARE_ON -> setting(m, "settings.allowAttendeeScreenShare", true);
      case ATTENDEE_SCREEN_SHARE_OFF -> setting(m, "settings.allowAttendeeScreenShare", false);
      case MAKE_COHOST -> makeCoHost(m, uid, target);
      case REVOKE_COHOST -> revokeCoHost(m, uid, target);
    }
  }

  /** Mutes live microphones; each person actually muted learns who did it. */
  private void mute(String meetingId, String uid, Predicate<String> who) {
    List<String> muted = policy.muteMicrophones(meetingId, who);
    if (muted.isEmpty()) {
      return;
    }
    PersonDto actor = MeetingMapper.person(uid, people.profiles(List.of(uid)));
    for (String identity : muted) {
      events.muted(meetingId, identity, actor);
    }
  }

  /**
   * Shuts every door, in this order: Mongo (never rejoins, loses co-host) → Redis (the topic filter
   * silences their open subscription, admission dropped) → hand lowered → {@code meet.removed} →
   * LiveKit kick. A LiveKit failure surfaces only after the removal is saved and announced.
   */
  private void remove(Meeting m, String uid, String target) {
    if (Objects.equals(target, uid)) {
      throw MeetingRequests.invalid("targetId");
    }
    if (!MeetingAccess.outranks(m, uid, target)) {
      throw forbidden();
    }
    String id = m.getId();
    Meeting updated =
        store
            .update(id, new Update().addToSet("removedIds", target).pull(COHOSTS, target))
            .orElseThrow(MeetingService::ended);
    lobby.markRemoved(id, target);
    if (lobby.remove(id, target)) {
      events.lobby(updated, lobby.waiting(id));
    }
    hands.lower(id, target);
    events.removed(id, target);
    policy.kick(id, target);
  }

  /** Sets one settings field (concurrent commands never overwrite each other); no-op if equal. */
  private void setting(Meeting m, String field, boolean value) {
    if (current(m.getSettings(), field) == value) {
      return;
    }
    Meeting updated =
        store.update(m.getId(), new Update().set(field, value)).orElseThrow(MeetingService::ended);
    events.settings(updated);
    if (field.endsWith("allowAttendeeScreenShare")) {
      policy.applyScreenShare(updated);
    }
  }

  /** Host only; the target must be in the room. Already a co-host ⇒ nothing to do. */
  private void makeCoHost(Meeting m, String uid, String target) {
    requireHost(m, uid);
    if (m.getCoHostIds() != null && m.getCoHostIds().contains(target)) {
      return;
    }
    if (Objects.equals(target, m.getHostId()) || !MeetingAccess.isInside(m, target)) {
      throw MeetingRequests.invalid("targetId");
    }
    String id = m.getId();
    Meeting updated =
        store.update(id, new Update().addToSet(COHOSTS, target)).orElseThrow(MeetingService::ended);
    events.roster(updated);
    events.lobbyTo(target, id, lobby.waiting(id));
    policy.applyPublishPermission(updated, target);
  }

  /** Host only; the former co-host stays admitted so a locked room never shuts them out. */
  private void revokeCoHost(Meeting m, String uid, String target) {
    requireHost(m, uid);
    if (m.getCoHostIds() == null || !m.getCoHostIds().contains(target)) {
      return;
    }
    String id = m.getId();
    Meeting updated =
        store.update(id, new Update().pull(COHOSTS, target)).orElseThrow(MeetingService::ended);
    lobby.admit(id, target);
    events.roster(updated);
    policy.applyPublishPermission(updated, target);
  }

  private static boolean current(Meeting.Settings s, String field) {
    Meeting.Settings settings = s == null ? new Meeting.Settings() : s;
    return switch (field) {
      case "settings.locked" -> settings.isLocked();
      case "settings.waitingRoom" -> settings.isWaitingRoom();
      default -> settings.isAllowAttendeeScreenShare();
    };
  }

  private static void requireHost(Meeting m, String uid) {
    if (uid == null || !uid.equals(m.getHostId())) {
      throw forbidden();
    }
  }

  private static ApiException forbidden() {
    return new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_FORBIDDEN);
  }
}
