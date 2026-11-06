package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AiConstants;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.MessageQueryService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/**
 * {@code @AI} in the in-meeting chat: hands the question (plus the last meeting chat lines) to
 * ai-service as conversation {@code meeting:{id}}. The answer comes back through {@link
 * MeetingAiReplyHandler}. Runs off the sender's thread, like {@code ChatController}'s trigger.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MeetingAiBridge {

  static final Pattern MENTION = Pattern.compile("(?i)@(AI|ponai)\\b");
  static final int HISTORY_SIZE = 20;

  private final MongoTemplate mongo;
  private final MeetingEvents events;
  private final AiRedisPublisher publisher;
  private final MessageQueryService queries;
  private final MeetingPeople people;

  /**
   * True when the chat line asks the AI something: it mentions {@code @AI} / {@code @ponai} AND
   * leaves a question once the mention is stripped. A bare {@code @AI} is just a chat line — no
   * request with empty content is ever sent to ai-service.
   */
  public static boolean mentionsAi(String text) {
    return text != null && MENTION.matcher(text).find() && !question(text).isEmpty();
  }

  /** The line with every mention removed, trimmed. */
  static String question(String text) {
    return MENTION.matcher(text).replaceAll("").trim();
  }

  /** Asks the AI on behalf of {@code caller}; returns at once. Never throws. */
  public void ask(UserPrincipal caller, String meetingId, String text) {
    CompletableFuture.runAsync(() -> run(caller, meetingId, text));
  }

  void run(UserPrincipal caller, String meetingId, String text) {
    String uid = caller.getUserId();
    String content = text == null ? "" : question(text);
    if (content.isEmpty()) {
      return; // a bare mention: nothing to ask
    }
    try {
      events.ai(meetingId, "thinking", uid, null);
      publisher.publishMeetingAiRequest(
          meetingId,
          uid,
          queries.resolveDisplayName(uid),
          content,
          history(meetingId, uid, text),
          caller.getRole(),
          caller.getPerms(),
          caller.getDepts());
    } catch (Exception e) {
      log.warn("Could not hand the @AI request of meeting {} to ai-service: {}", meetingId, e);
      events.ai(meetingId, "error", uid, "AI_UNAVAILABLE");
    }
  }

  /**
   * The newest {@value #HISTORY_SIZE} chat lines in ascending order, AI bot lines as {@code
   * assistant}, the triggering line itself left out; each attributed by display name.
   */
  private List<AiHistoryEntry> history(String meetingId, String askerId, String triggerText) {
    Query query =
        Query.query(Criteria.where("meetingId").is(meetingId))
            .with(
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "_id")))
            .limit(HISTORY_SIZE + 1);
    List<MeetingMessage> rows = new ArrayList<>(mongo.find(query, MeetingMessage.class));
    for (int i = 0; i < rows.size(); i++) {
      MeetingMessage row = rows.get(i);
      if (askerId.equals(row.getSenderId()) && triggerText.equals(row.getContent())) {
        rows.remove(i);
        break;
      }
    }
    if (rows.size() > HISTORY_SIZE) {
      rows = rows.subList(0, HISTORY_SIZE);
    }
    Collections.reverse(rows);

    Set<String> humans = new LinkedHashSet<>();
    for (MeetingMessage row : rows) {
      if (row.getSenderId() != null && !AiConstants.AI_BOT_USER_ID.equals(row.getSenderId())) {
        humans.add(row.getSenderId());
      }
    }
    Map<String, PersonDto> profiles = humans.isEmpty() ? Map.of() : people.profiles(humans);
    List<AiHistoryEntry> out = new ArrayList<>();
    for (MeetingMessage row : rows) {
      String content =
          row.getContent() == null ? "" : MENTION.matcher(row.getContent()).replaceAll("").trim();
      if (content.isEmpty()) {
        continue;
      }
      boolean bot = AiConstants.AI_BOT_USER_ID.equals(row.getSenderId());
      String name = bot ? null : MeetingMapper.person(row.getSenderId(), profiles).displayName();
      out.add(
          AiHistoryEntry.text(bot ? "assistant" : "user", content)
              .withSender(row.getSenderId(), name));
    }
    return out;
  }
}
