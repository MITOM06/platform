package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AiMemoryResponse;
import com.platform.chatservice.model.AiMemory;
import com.platform.chatservice.repository.AiMemoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiMemoryControllerTest {

    @Mock
    private AiMemoryRepository aiMemoryRepository;

    @Mock
    private Principal principal;

    @InjectMocks
    private AiMemoryController controller;

    private static final String USER_ID = "user-001";
    private static final String CONV_ID = "conv-001";

    private AiMemory memory;

    @BeforeEach
    void setUp() {
        when(principal.getName()).thenReturn(USER_ID);
        memory = AiMemory.builder()
            .id("mem-1")
            .conversationId(CONV_ID)
            .userId(USER_ID)
            .summary("The user discussed Flutter and Redis.")
            .keyFacts(List.of("Uses Flutter", "Uses Redis"))
            .messageCount(20)
            .updatedAt(Instant.now())
            .build();
    }

    @Test
    void getMyMemories_ReturnsOnlyUserMemories() {
        when(aiMemoryRepository.findByUserId(USER_ID)).thenReturn(List.of(memory));

        ResponseEntity<List<AiMemoryResponse>> response = controller.getMyMemories(principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
        assertThat(response.getBody().get(0).conversationId()).isEqualTo(CONV_ID);
        assertThat(response.getBody().get(0).summary()).isEqualTo("The user discussed Flutter and Redis.");
        verify(aiMemoryRepository).findByUserId(USER_ID);
    }

    @Test
    void getConversationMemory_ReturnsMemoryForOwner() {
        when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.of(memory));

        ResponseEntity<AiMemoryResponse> response = controller.getConversationMemory(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().conversationId()).isEqualTo(CONV_ID);
    }

    @Test
    void getConversationMemory_ReturnsNotFoundForWrongUser() {
        AiMemory otherMemory = AiMemory.builder()
            .id("mem-2").conversationId(CONV_ID).userId("other-user")
            .summary("Other").keyFacts(List.of()).messageCount(5).updatedAt(Instant.now()).build();
        when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.of(otherMemory));

        ResponseEntity<AiMemoryResponse> response = controller.getConversationMemory(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void deleteMemory_Returns204AndDeletesWhenOwner() {
        when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.of(memory));

        ResponseEntity<Void> response = controller.deleteMemory(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(aiMemoryRepository).deleteByConversationId(CONV_ID);
    }

    @Test
    void deleteMemory_Returns403WhenNotOwner() {
        AiMemory otherMemory = AiMemory.builder()
            .id("mem-2").conversationId(CONV_ID).userId("other-user")
            .summary("Other").keyFacts(List.of()).messageCount(5).updatedAt(Instant.now()).build();
        when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.of(otherMemory));

        ResponseEntity<Void> response = controller.deleteMemory(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verify(aiMemoryRepository, never()).deleteByConversationId(any());
    }

    @Test
    void deleteMemory_Returns404WhenNotFound() {
        when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.empty());

        ResponseEntity<Void> response = controller.deleteMemory(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
