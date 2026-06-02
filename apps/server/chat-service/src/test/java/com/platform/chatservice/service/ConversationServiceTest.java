package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.DuplicateConversationException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {

    @Mock private ConversationRepository conversationRepository;
    @Mock private MessageRepository messageRepository;
    @Mock private com.platform.chatservice.repository.FriendshipRepository friendshipRepository;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks
    private ConversationService conversationService;

    private static final String USER_ID = "user-001";
    private static final String OTHER_ID = "user-002";
    private static final String CONV_ID = "conv-001";

    private Conversation conversation;

    @BeforeEach
    void setUp() {
        conversation = Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(USER_ID, OTHER_ID))
            .createdAt(Instant.now())
            .build();
    }

    @Test
    void createConversation_ShouldSaveAndReturnResponse() {
        when(conversationRepository.findOneOnOneConversation(any())).thenReturn(Optional.empty());
        when(conversationRepository.save(any(Conversation.class))).thenReturn(conversation);

        ConversationResponse response = conversationService.createConversation(USER_ID, OTHER_ID);

        assertThat(response.id()).isEqualTo(CONV_ID);
        assertThat(response.participants()).containsExactlyInAnyOrder(USER_ID, OTHER_ID);
        assertThat(response.unreadCount()).isZero();
        verify(conversationRepository).save(any(Conversation.class));
    }

    @Test
    void createConversation_WhenDuplicate_ShouldThrowAndNotSave() {
        when(conversationRepository.findOneOnOneConversation(any()))
            .thenReturn(Optional.of(conversation));

        assertThatThrownBy(() -> conversationService.createConversation(USER_ID, OTHER_ID))
            .isInstanceOf(DuplicateConversationException.class)
            .extracting("conversationId")
            .isEqualTo(CONV_ID);

        verify(conversationRepository, never()).save(any());
    }

    @Test
    void createConversation_WhenNotFriends_ShouldBePending() {
        when(conversationRepository.findOneOnOneConversation(any())).thenReturn(Optional.empty());
        when(conversationRepository.save(any(Conversation.class))).thenReturn(conversation);

        conversationService.createConversation(USER_ID, OTHER_ID);

        var captor = org.mockito.ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(Conversation.STATUS_PENDING);
    }

    @Test
    void createConversation_WhenFriends_ShouldBeAccepted() {
        when(conversationRepository.findOneOnOneConversation(any())).thenReturn(Optional.empty());
        when(friendshipRepository.findAcceptedBetween(USER_ID, OTHER_ID))
            .thenReturn(Optional.of(new com.platform.chatservice.model.Friendship()));
        when(conversationRepository.save(any(Conversation.class))).thenReturn(conversation);

        conversationService.createConversation(USER_ID, OTHER_ID);

        var captor = org.mockito.ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(Conversation.STATUS_ACCEPTED);
    }

    @Test
    void acceptConversation_ByRecipient_ShouldSetAccepted() {
        Conversation pending = Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(USER_ID, OTHER_ID))
            .createdBy(USER_ID)
            .status(Conversation.STATUS_PENDING)
            .createdAt(Instant.now())
            .build();
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(pending));
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(messageRepository.countUnread(CONV_ID, OTHER_ID)).thenReturn(0L);

        ConversationResponse response = conversationService.acceptConversation(OTHER_ID, CONV_ID);

        assertThat(response.status()).isEqualTo(Conversation.STATUS_ACCEPTED);
    }

    @Test
    void acceptConversation_ByInitiator_ShouldThrow() {
        Conversation pending = Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(USER_ID, OTHER_ID))
            .createdBy(USER_ID)
            .status(Conversation.STATUS_PENDING)
            .createdAt(Instant.now())
            .build();
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> conversationService.acceptConversation(USER_ID, CONV_ID))
            .isInstanceOf(com.platform.chatservice.exception.UnauthorizedException.class);
        verify(conversationRepository, never()).save(any());
    }

    @Test
    void getConversation_ShouldReturnConversation() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(messageRepository.countUnread(CONV_ID, USER_ID)).thenReturn(3L);

        ConversationResponse response = conversationService.getConversation(USER_ID, CONV_ID);

        assertThat(response.id()).isEqualTo(CONV_ID);
        assertThat(response.unreadCount()).isEqualTo(3L);
    }

    @Test
    void getConversation_WhenUserNotParticipant_ShouldThrow() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

        assertThatThrownBy(() -> conversationService.getConversation("intruder-999", CONV_ID))
            .isInstanceOf(ConversationNotFoundException.class);
    }

    @Test
    void getConversation_WhenNotFound_ShouldThrow() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> conversationService.getConversation(USER_ID, CONV_ID))
            .isInstanceOf(ConversationNotFoundException.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void listConversations_ShouldReturnPagedResult() {
        var pageable = PageRequest.of(0, 20);
        when(conversationRepository.findByParticipantsContainingOrderByLastMessageAtDesc(USER_ID, pageable))
            .thenReturn(new PageImpl<>(List.of(conversation)));

        AggregationResults<Document> aggResults = mock(AggregationResults.class);
        when(aggResults.getMappedResults()).thenReturn(List.of());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq("messages"), eq(Document.class)))
            .thenReturn(aggResults);

        PageResponse<ConversationResponse> result =
            conversationService.listConversations(USER_ID, pageable);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).id()).isEqualTo(CONV_ID);
        assertThat(result.page()).isZero();
        assertThat(result.totalElements()).isEqualTo(1L);
    }

    @Test
    @SuppressWarnings("unchecked")
    void listConversations_WhenEmpty_ShouldReturnEmptyPage() {
        var pageable = PageRequest.of(0, 20);
        when(conversationRepository.findByParticipantsContainingOrderByLastMessageAtDesc(USER_ID, pageable))
            .thenReturn(new PageImpl<>(List.of()));

        PageResponse<ConversationResponse> result =
            conversationService.listConversations(USER_ID, pageable);

        assertThat(result.content()).isEmpty();
        verifyNoInteractions(mongoTemplate);
    }

    @Test
    void getParticipants_ShouldReturnParticipantList() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

        List<String> participants = conversationService.getParticipants(CONV_ID);

        assertThat(participants).containsExactlyInAnyOrder(USER_ID, OTHER_ID);
    }

    @Test
    void getParticipants_WhenNotFound_ShouldReturnEmptyList() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.empty());

        List<String> participants = conversationService.getParticipants(CONV_ID);

        assertThat(participants).isEmpty();
    }

    @Test
    void muteConversation_ShouldAddUserToMutedUsersList() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(messageRepository.countUnread(CONV_ID, USER_ID)).thenReturn(0L);

        ConversationResponse response = conversationService.muteConversation(USER_ID, CONV_ID);

        assertThat(response.isMuted()).isTrue();
    }

    @Test
    void unmuteConversation_ShouldRemoveUserFromMutedUsersList() {
        conversation.setMutedUsers(new java.util.ArrayList<>(List.of(USER_ID)));
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(messageRepository.countUnread(CONV_ID, USER_ID)).thenReturn(0L);

        ConversationResponse response = conversationService.unmuteConversation(USER_ID, CONV_ID);

        assertThat(response.isMuted()).isFalse();
    }

    @Test
    void archiveConversation_ShouldAddUserToArchivedList() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(messageRepository.countUnread(CONV_ID, USER_ID)).thenReturn(0L);

        ConversationResponse response = conversationService.archiveConversation(USER_ID, CONV_ID);

        assertThat(response.isArchived()).isTrue();
    }

    @Test
    void unarchiveConversation_ShouldRemoveUserFromArchivedList() {
        conversation.setArchivedBy(new java.util.ArrayList<>(List.of(USER_ID)));
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(conversationRepository.save(any(Conversation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(messageRepository.countUnread(CONV_ID, USER_ID)).thenReturn(0L);

        ConversationResponse response = conversationService.unarchiveConversation(USER_ID, CONV_ID);

        assertThat(response.isArchived()).isFalse();
    }

    @Test
    void markConversationUnread_WhenMessageExists_ShouldRemoveUserFromReadBy() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        com.platform.chatservice.model.Message lastMsg = com.platform.chatservice.model.Message.builder()
            .id("msg-001")
            .conversationId(CONV_ID)
            .senderId(OTHER_ID)
            .readBy(new java.util.ArrayList<>(List.of(USER_ID, OTHER_ID)))
            .createdAt(Instant.now())
            .build();
        when(messageRepository.findByConversationIdOrderByCreatedAtDesc(eq(CONV_ID), any()))
            .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(lastMsg)));
        when(messageRepository.save(any(com.platform.chatservice.model.Message.class))).thenReturn(lastMsg);
        when(messageRepository.countUnread(CONV_ID, USER_ID)).thenReturn(1L);

        ConversationResponse response = conversationService.markConversationUnread(USER_ID, CONV_ID);

        assertThat(response.unreadCount()).isEqualTo(1L);
        assertThat(lastMsg.getReadBy()).containsExactly(OTHER_ID);
        verify(messageRepository).save(lastMsg);
    }

    @Test
    void markConversationRead_ShouldAddUserToReadByForAllUnreadMessages() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        com.platform.chatservice.model.Message unreadMsg = com.platform.chatservice.model.Message.builder()
            .id("msg-001")
            .conversationId(CONV_ID)
            .senderId(OTHER_ID)
            .readBy(new java.util.ArrayList<>(List.of(OTHER_ID)))
            .createdAt(Instant.now())
            .build();
        when(mongoTemplate.find(any(org.springframework.data.mongodb.core.query.Query.class), eq(com.platform.chatservice.model.Message.class)))
            .thenReturn(List.of(unreadMsg));

        ConversationResponse response = conversationService.markConversationRead(USER_ID, CONV_ID);

        assertThat(response.unreadCount()).isZero();
        assertThat(unreadMsg.getReadBy()).containsExactlyInAnyOrder(OTHER_ID, USER_ID);
        verify(messageRepository).saveAll(anyList());
    }
}
