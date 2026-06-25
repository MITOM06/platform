package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiMessageServiceTest {

  @Mock private MessageRepository messageRepository;
  @Mock private ConversationRepository conversationRepository;
  @Mock private SimpMessagingTemplate messagingTemplate;
  @Mock private MessageMapper messageMapper;

  @Test
  void saveBotMessage_persistsWithGivenSenderAndBroadcasts() {
    AiMessageService service =
        new AiMessageService(
            messageRepository, conversationRepository, messagingTemplate, messageMapper);
    when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));
    when(conversationRepository.findById(any())).thenReturn(Optional.empty());
    when(messageMapper.toResponse(any(Message.class)))
        .thenReturn(
            new MessageResponse(
                "msg-1",
                "conv-1",
                "extbot:bf-1",
                "Hello from the assistant",
                "ai",
                List.of(),
                null));

    service.saveBotMessage("conv-1", "extbot:bf-1", "Hello from the assistant");

    ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
    verify(messageRepository).save(captor.capture());
    Message saved = captor.getValue();
    assertThat(saved.getConversationId()).isEqualTo("conv-1");
    assertThat(saved.getSenderId()).isEqualTo("extbot:bf-1");
    assertThat(saved.getType()).isEqualTo("ai");
    assertThat(saved.getContent()).isEqualTo("Hello from the assistant");
    verify(messagingTemplate).convertAndSend(eq("/topic/conversation/conv-1"), any(Object.class));
  }
}
