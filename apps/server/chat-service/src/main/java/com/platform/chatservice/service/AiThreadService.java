package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.AiPersona;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.AiPersonaRepository;
import com.platform.chatservice.repository.ConversationRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * ChatGPT-style AI threads: every "new chat" with the assistant is its own {@code direct}
 * conversation between the user and the AI bot. {@link ConversationService#createConversation}
 * keeps refusing a second DM for the same pair (older clients rely on that 409), so threads are
 * created here instead.
 */
@Service
@RequiredArgsConstructor
public class AiThreadService {

  static final int MAX_LIST = 100;
  static final int MAX_NAME_LENGTH = 80;
  static final int TITLE_LENGTH = 60;

  private final ConversationRepository conversationRepository;
  private final ConversationCacheService conversationCacheService;
  private final AiPersonaRepository aiPersonaRepository;
  private final ConversationWriteSupport support;
  private final ConversationEventPublisher events;

  /**
   * New thread {@code [user, AI_BOT]}; the persona of the most recently active thread is copied.
   */
  public ConversationResponse create(String userId) {
    List<Conversation> existing = threadsOf(userId);
    Conversation saved =
        conversationCacheService.save(
            Conversation.builder()
                .participants(List.of(userId, AiConstants.AI_BOT_USER_ID))
                .type(Conversation.TYPE_DIRECT)
                .createdBy(userId)
                .status(Conversation.STATUS_ACCEPTED)
                .build());
    existing.stream()
        .max(ACTIVITY)
        .flatMap(latest -> aiPersonaRepository.findByConversationId(latest.getId()))
        .ifPresent(source -> aiPersonaRepository.save(copyPersona(source, saved.getId(), userId)));
    return support.view(saved, userId, 0L);
  }

  /** The caller's visible AI threads, newest activity first (max {@value #MAX_LIST}). */
  public List<ConversationResponse> list(String userId) {
    return threadsOf(userId).stream()
        .filter(c -> c.getHiddenFor() == null || !c.getHiddenFor().contains(userId))
        .filter(c -> c.getBlockedBy() == null || !c.getBlockedBy().contains(userId))
        .sorted(ACTIVITY.reversed())
        .limit(MAX_LIST)
        .map(c -> support.view(c, userId, 0L))
        .toList();
  }

  /** Rename. 404 unless {@code id} is one of the caller's AI threads; 400 on a bad name. */
  public ConversationResponse rename(String userId, String id, String rawName) {
    Conversation thread = support.requireParticipant(userId, id);
    if (!isAiThread(thread)) {
      throw new ConversationNotFoundException(id);
    }
    String name = rawName == null ? "" : rawName.trim();
    if (name.isEmpty() || name.length() > MAX_NAME_LENGTH) {
      throw new BadRequestException(
          ErrorCodes.AI_THREAD_NAME_INVALID, "Thread name must be 1-80 characters");
    }
    Conversation updated = support.update(id, null, new Update().set("name", name));
    return support.view(updated != null ? updated : thread, userId, 0L);
  }

  /**
   * Title an untitled AI thread from the user's first message: first {@value #TITLE_LENGTH}
   * characters, whitespace collapsed, {@code …} when cut. Never overwrites an existing name (the
   * write is guarded atomically, so a concurrent rename wins) and ignores non-AI conversations.
   */
  public void maybeAutoTitle(Conversation conversation, String userText) {
    if (conversation == null
        || userText == null
        || !isAiThread(conversation)
        || (conversation.getName() != null && !conversation.getName().isBlank())) {
      return;
    }
    String title = toTitle(userText);
    if (title.isEmpty()) {
      return;
    }
    Criteria unnamed =
        new Criteria().orOperator(Criteria.where("name").is(null), Criteria.where("name").is(""));
    Conversation updated =
        support.update(conversation.getId(), unnamed, new Update().set("name", title));
    if (updated != null) {
      events.publishShared(support.view(updated, null, 0L));
    }
  }

  static String toTitle(String text) {
    String collapsed = text.trim().replaceAll("\\s+", " ");
    if (collapsed.length() <= TITLE_LENGTH) {
      return collapsed;
    }
    int end = TITLE_LENGTH - 1;
    if (Character.isHighSurrogate(collapsed.charAt(end - 1))) {
      end--;
    }
    return collapsed.substring(0, end) + "…";
  }

  static boolean isAiThread(Conversation c) {
    return !c.isGroup()
        && c.getParticipants() != null
        && c.getParticipants().size() == 2
        && c.getParticipants().contains(AiConstants.AI_BOT_USER_ID);
  }

  private List<Conversation> threadsOf(String userId) {
    return conversationRepository.findTwoMemberNonGroupConversations(
        List.of(userId, AiConstants.AI_BOT_USER_ID));
  }

  private static AiPersona copyPersona(AiPersona source, String conversationId, String userId) {
    return AiPersona.builder()
        .conversationId(conversationId)
        .name(source.getName())
        .avatarUrl(source.getAvatarUrl())
        .tone(source.getTone())
        .systemPromptPrefix(source.getSystemPromptPrefix())
        .createdBy(userId)
        .build();
  }

  /** {@code lastMessageAt}, falling back to {@code createdAt}. */
  private static final Comparator<Conversation> ACTIVITY =
      Comparator.comparing(
          (Conversation c) ->
              c.getLastMessageAt() != null ? c.getLastMessageAt() : c.getCreatedAt(),
          Comparator.nullsFirst(Comparator.<Instant>naturalOrder()));
}
