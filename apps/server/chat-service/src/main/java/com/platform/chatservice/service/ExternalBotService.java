package com.platform.chatservice.service;

import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Bridges PON chat to a member's external Bot Factory personal assistant. Phase 1 handles 1-1
 * conversations only: a 2-participant conversation whose other member is an enabled bot owned by
 * the sender. Group {@code @mention} routing is a later phase.
 */
@Service
@RequiredArgsConstructor
public class ExternalBotService {

  private final ConversationService conversationService;
  private final ExternalBotRepository externalBotRepository;
  private final BotFactoryClient botFactoryClient;
  private final AiMessageService aiMessageService;

  /**
   * The personal-assistant bot that should answer this message, or empty when the conversation is
   * not a 1-1 between {@code senderId} and an enabled bot they own.
   */
  public Optional<ExternalBot> resolveAssistant(String conversationId, String senderId) {
    List<String> participants = conversationService.getParticipants(conversationId);
    if (participants == null || participants.size() != 2 || !participants.contains(senderId)) {
      return Optional.empty();
    }
    String other = participants.get(0).equals(senderId) ? participants.get(1) : participants.get(0);
    if (other.equals(senderId)) {
      return Optional.empty();
    }
    return externalBotRepository
        .findByBotUserId(other)
        .filter(ExternalBot::isEnabled)
        .filter(bot -> senderId.equals(bot.getOwnerUserId()));
  }

  /**
   * Ask Bot Factory for a reply (memory keyed per PON conversation) and persist+broadcast it as the
   * bot. No-op when Bot Factory is unconfigured or returns nothing.
   */
  public void reply(ExternalBot bot, String conversationId, String content) {
    String replyText =
        botFactoryClient.chat(bot.getFactoryBotId(), content, "pon:" + conversationId);
    if (replyText != null && !replyText.isBlank()) {
      aiMessageService.saveBotMessage(conversationId, bot.getBotUserId(), replyText);
    }
  }
}
