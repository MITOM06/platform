package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExternalBotServiceTest {

  @Mock private ConversationQueryService conversationQueryService;
  @Mock private ExternalBotRepository externalBotRepository;
  @Mock private BotFactoryClient botFactoryClient;
  @Mock private AiMessageService aiMessageService;

  private ExternalBotService service() {
    return new ExternalBotService(
        conversationQueryService, externalBotRepository, botFactoryClient, aiMessageService);
  }

  private ExternalBot bot() {
    return ExternalBot.builder()
        .id("eb-1")
        .botUserId("extbot:bf-1")
        .factoryBotId("bf-1")
        .ownerUserId("user-1")
        .name("My Assistant")
        .enabled(true)
        .build();
  }

  @Test
  void resolveAssistant_returnsBot_forOwned1on1() {
    when(conversationQueryService.getParticipants("conv-1"))
        .thenReturn(List.of("user-1", "extbot:bf-1"));
    when(externalBotRepository.findByBotUserId("extbot:bf-1")).thenReturn(Optional.of(bot()));

    Optional<ExternalBot> result = service().resolveAssistant("conv-1", "user-1");

    assertThat(result).isPresent();
    assertThat(result.get().getFactoryBotId()).isEqualTo("bf-1");
  }

  @Test
  void resolveAssistant_empty_whenGroup() {
    when(conversationQueryService.getParticipants("conv-1"))
        .thenReturn(List.of("user-1", "user-2", "extbot:bf-1"));
    assertThat(service().resolveAssistant("conv-1", "user-1")).isEmpty();
  }

  @Test
  void resolveAssistant_empty_whenSenderIsNotOwner() {
    when(conversationQueryService.getParticipants("conv-1"))
        .thenReturn(List.of("user-2", "extbot:bf-1"));
    when(externalBotRepository.findByBotUserId("extbot:bf-1")).thenReturn(Optional.of(bot()));
    assertThat(service().resolveAssistant("conv-1", "user-2")).isEmpty();
  }

  @Test
  void reply_persistsReturnedText() {
    when(botFactoryClient.chat("bf-1", "hello", "pon:conv-1")).thenReturn("hi back");
    service().reply(bot(), "conv-1", "hello");
    verify(aiMessageService).saveBotMessage("conv-1", "extbot:bf-1", "hi back");
  }

  @Test
  void reply_noop_whenClientReturnsNull() {
    when(botFactoryClient.chat(any(), any(), any())).thenReturn(null);
    service().reply(bot(), "conv-1", "hello");
    verify(aiMessageService, never()).saveBotMessage(eq("conv-1"), any(), any());
  }
}
