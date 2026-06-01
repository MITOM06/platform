package com.platform.chatservice.service;

import com.mongodb.client.result.UpdateResult;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock private MessageRepository messageRepository;
    @Mock private ConversationRepository conversationRepository;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks
    private MessageService messageService;

    private static final String SENDER_ID = "user-001";
    private static final String OTHER_ID = "user-002";
    private static final String CONV_ID = "conv-001";
    private static final String MSG_ID = "msg-001";

    private Conversation conversation;
    private Message savedMessage;

    @BeforeEach
    void setUp() {
        conversation = Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(SENDER_ID, OTHER_ID))
            .build();
        savedMessage = Message.builder()
            .id(MSG_ID)
            .conversationId(CONV_ID)
            .senderId(SENDER_ID)
            .content("Hello")
            .type("text")
            .readBy(List.of(SENDER_ID))
            .createdAt(Instant.now())
            .build();
    }

    @Test
    void sendMessage_ShouldSaveMessageAndUpdateConversation() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);
        when(conversationRepository.save(any(Conversation.class))).thenReturn(conversation);

        MessageResponse response = messageService.sendMessage(SENDER_ID,
            new SendMessageRequest(CONV_ID, "Hello", "text"));

        assertThat(response.id()).isEqualTo(MSG_ID);
        assertThat(response.content()).isEqualTo("Hello");
        assertThat(response.senderId()).isEqualTo(SENDER_ID);
        verify(messageRepository).save(any(Message.class));
        verify(conversationRepository).save(any(Conversation.class));
    }

    @Test
    void sendMessage_ByRecipientOnPending_ShouldAcceptConversation() {
        Conversation pending = Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(SENDER_ID, OTHER_ID))
            .createdBy(OTHER_ID) // OTHER started the request; SENDER is the recipient replying
            .status(Conversation.STATUS_PENDING)
            .build();
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(pending));
        when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(inv -> inv.getArgument(0));

        messageService.sendMessage(SENDER_ID, new SendMessageRequest(CONV_ID, "Hello", "text"));

        verify(conversationRepository).save(argThat(c -> Conversation.STATUS_ACCEPTED.equals(c.getStatus())));
    }

    @Test
    void sendMessage_ByInitiatorOnPending_ShouldStayPending() {
        Conversation pending = Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(SENDER_ID, OTHER_ID))
            .createdBy(SENDER_ID) // SENDER is the initiator; their message must not auto-accept
            .status(Conversation.STATUS_PENDING)
            .build();
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(pending));
        when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(inv -> inv.getArgument(0));

        messageService.sendMessage(SENDER_ID, new SendMessageRequest(CONV_ID, "Hi", "text"));

        verify(conversationRepository).save(argThat(c -> Conversation.STATUS_PENDING.equals(c.getStatus())));
    }

    @Test
    void sendMessage_ShouldDefaultTypeToText_WhenTypeIsNull() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);
        when(conversationRepository.save(any(Conversation.class))).thenReturn(conversation);

        messageService.sendMessage(SENDER_ID, new SendMessageRequest(CONV_ID, "Hello", null));

        verify(messageRepository).save(argThat(m -> "text".equals(m.getType())));
    }

    @Test
    void sendMessage_WhenConversationNotFound_ShouldThrow() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.sendMessage(SENDER_ID,
                new SendMessageRequest(CONV_ID, "Hi", "text")))
            .isInstanceOf(ConversationNotFoundException.class);

        verifyNoInteractions(messageRepository);
    }

    @Test
    void sendMessage_WhenUserNotParticipant_ShouldThrow() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

        assertThatThrownBy(() -> messageService.sendMessage("intruder-999",
                new SendMessageRequest(CONV_ID, "Hi", "text")))
            .isInstanceOf(ConversationNotFoundException.class);

        verifyNoInteractions(messageRepository);
    }

    @Test
    void getMessages_ShouldReturnPagedResponse() {
        var pageable = PageRequest.of(0, 20);
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(messageRepository.findByConversationIdOrderByCreatedAtDesc(CONV_ID, pageable))
            .thenReturn(new PageImpl<>(List.of(savedMessage)));

        PageResponse<MessageResponse> result =
            messageService.getMessages(SENDER_ID, CONV_ID, pageable);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).id()).isEqualTo(MSG_ID);
        assertThat(result.page()).isZero();
    }

    @Test
    void getMessages_WhenUserNotParticipant_ShouldThrow() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

        assertThatThrownBy(() -> messageService.getMessages("outsider", CONV_ID, PageRequest.of(0, 20)))
            .isInstanceOf(ConversationNotFoundException.class);
    }

    @Test
    void markAsRead_WhenMessageExists_ShouldUpdateReadBy() {
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getMatchedCount()).thenReturn(1L);
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(Message.class)))
            .thenReturn(updateResult);

        messageService.markAsRead(SENDER_ID, MSG_ID);

        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(Message.class));
    }

    @Test
    void markAsRead_WhenMessageNotFound_ShouldThrow() {
        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getMatchedCount()).thenReturn(0L);
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(Message.class)))
            .thenReturn(updateResult);

        assertThatThrownBy(() -> messageService.markAsRead(SENDER_ID, "non-existent"))
            .isInstanceOf(MessageNotFoundException.class);
    }
}
