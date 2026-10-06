package com.platform.chatservice.service;

import com.platform.chatservice.model.AiPersona;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.AiPersonaRepository;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Display names of message senders for text that is NOT shown in a client but still must never
 * carry raw ids — today the {@code senderName} of each {@code ai.requests} history entry, so the
 * assistant can say who said what in a group. Same naming as notifications ({@code
 * MessageNotificationService}): the built-in AI is its conversation's persona name (default {@value
 * #DEFAULT_AI_NAME}), a Bot Factory assistant ({@code extbot:*}) its registry name, a human their
 * {@code users.displayName}. Unresolvable senders are left out of the map (callers then send no
 * name; ai-service labels them generically) — an id is never used as a name.
 */
@Component
@RequiredArgsConstructor
public class SenderNameResolver {

  /** Name of the built-in AI when the conversation has no persona of its own. */
  static final String DEFAULT_AI_NAME = "PON AI";

  private final MessageServiceHelper helper;
  private final AiPersonaRepository aiPersonaRepository;
  private final ExternalBotRepository externalBotRepository;

  /** {@code senderId → display name} for the senders that resolve (one users query). */
  public Map<String, String> displayNames(String conversationId, Collection<String> senderIds) {
    Map<String, String> names = new HashMap<>();
    if (senderIds == null || senderIds.isEmpty()) {
      return names;
    }
    Set<String> humans = new LinkedHashSet<>();
    for (String senderId : new LinkedHashSet<>(senderIds)) {
      if (senderId == null) continue;
      if (AiConstants.AI_BOT_USER_ID.equals(senderId)) {
        names.put(senderId, assistantName(conversationId));
      } else if (senderId.startsWith("extbot:")) {
        botName(senderId).ifPresent(name -> names.put(senderId, name));
      } else {
        humans.add(senderId);
      }
    }
    names.putAll(helper.lookupDisplayNames(humans));
    return names;
  }

  /** The built-in AI's name in {@code conversationId} (persona name, else the default). */
  public String assistantName(String conversationId) {
    if (conversationId == null) return DEFAULT_AI_NAME;
    return aiPersonaRepository
        .findByConversationId(conversationId)
        .map(AiPersona::getName)
        .filter(name -> name != null && !name.isBlank())
        .orElse(DEFAULT_AI_NAME);
  }

  private java.util.Optional<String> botName(String botUserId) {
    return externalBotRepository
        .findByBotUserId(botUserId)
        .map(ExternalBot::getName)
        .filter(name -> name != null && !name.isBlank());
  }
}
