package com.platform.chatservice.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ChatMessageDto;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.CallService;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationQueryService;
import com.platform.chatservice.service.ExternalBotService;
import com.platform.chatservice.service.FcmService;
import com.platform.chatservice.service.MessageQueryService;
import com.platform.chatservice.service.MessageService;
import com.platform.chatservice.service.RateLimiterService;
import java.security.Principal;
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
class ChatControllerExternalBotTest {

  @Mock private MessageService messageService;
  @Mock private MessageQueryService messageQueryService;
  @Mock private ConversationQueryService conversationQueryService;
  @Mock private ClusterMessageBroker clusterBroker;
  @Mock private FcmService fcmService;
  @Mock private RateLimiterService rateLimiterService;
  @Mock private AiRedisPublisher aiRedisPublisher;
  @Mock private CallService callService;
  @Mock private ExternalBotService externalBotService;
  @Mock private MessageResponse messageResponse;

  @Test
  void send_triggersAssistantReply_forResolvedBot() {
    ChatController controller =
        new ChatController(
            messageService,
            messageQueryService,
            conversationQueryService,
            clusterBroker,
            fcmService,
            rateLimiterService,
            aiRedisPublisher,
            callService,
            externalBotService);

    when(messageService.sendMessage(any(), any())).thenReturn(messageResponse);
    when(messageResponse.mentions()).thenReturn(null);
    when(conversationQueryService.getParticipants("conv-1")).thenReturn(List.of("user-1"));
    ExternalBot bot =
        ExternalBot.builder()
            .botUserId("extbot:bf-1")
            .factoryBotId("bf-1")
            .ownerUserId("user-1")
            .build();
    when(externalBotService.resolveAssistant("conv-1", "user-1")).thenReturn(Optional.of(bot));

    ChatMessageDto dto = new ChatMessageDto();
    dto.setConversationId("conv-1");
    dto.setContent("what's on my calendar?");
    dto.setType("text");
    Principal principal = () -> "user-1";

    controller.send(dto, principal);

    verify(externalBotService, timeout(1000)).reply(bot, "conv-1", "what's on my calendar?");
  }

  @Test
  void send_noAssistant_doesNotReply() {
    ChatController controller =
        new ChatController(
            messageService,
            messageQueryService,
            conversationQueryService,
            clusterBroker,
            fcmService,
            rateLimiterService,
            aiRedisPublisher,
            callService,
            externalBotService);

    when(messageService.sendMessage(any(), any())).thenReturn(messageResponse);
    when(messageResponse.mentions()).thenReturn(null);
    when(conversationQueryService.getParticipants("conv-1")).thenReturn(List.of("user-1"));
    when(externalBotService.resolveAssistant("conv-1", "user-1")).thenReturn(Optional.empty());

    ChatMessageDto dto = new ChatMessageDto();
    dto.setConversationId("conv-1");
    dto.setContent("hello");
    dto.setType("text");
    Principal principal = () -> "user-1";

    controller.send(dto, principal);

    verify(externalBotService, after(300).never()).reply(any(), any(), any());
  }
}
