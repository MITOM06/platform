package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AiPersonaRequest;
import com.platform.chatservice.dto.AiPersonaResponse;
import com.platform.chatservice.model.AiPersona;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.AiPersonaRepository;
import com.platform.chatservice.repository.ConversationRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiPersonaControllerTest {

    @Mock
    private AiPersonaRepository aiPersonaRepository;

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private Principal principal;

    @InjectMocks
    private AiPersonaController controller;

    private static final String ADMIN_ID = "admin-001";
    private static final String MEMBER_ID = "member-001";
    private static final String CONV_ID = "conv-001";

    private Conversation groupConv;
    private AiPersona persona;

    @BeforeEach
    void setUp() {
        when(principal.getName()).thenReturn(ADMIN_ID);

        groupConv = Conversation.builder()
            .id(CONV_ID)
            .type("group")
            .participants(List.of(ADMIN_ID, MEMBER_ID))
            .admins(List.of(ADMIN_ID))
            .build();

        persona = AiPersona.builder()
            .id("persona-1")
            .conversationId(CONV_ID)
            .name("DevBot")
            .tone("professional")
            .createdBy(ADMIN_ID)
            .updatedAt(Instant.now())
            .build();
    }

    @Test
    void getPersona_ReturnsForbiddenForNonParticipant() {
        Conversation conv = Conversation.builder()
            .id(CONV_ID)
            .participants(List.of("other-user"))
            .build();
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conv));

        ResponseEntity<AiPersonaResponse> response = controller.getPersona(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void getPersona_Returns404WhenNone() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(groupConv));
        when(aiPersonaRepository.findByConversationId(CONV_ID)).thenReturn(Optional.empty());

        ResponseEntity<AiPersonaResponse> response = controller.getPersona(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getPersona_ReturnsPersonaWhenExists() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(groupConv));
        when(aiPersonaRepository.findByConversationId(CONV_ID)).thenReturn(Optional.of(persona));

        ResponseEntity<AiPersonaResponse> response = controller.getPersona(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("DevBot");
    }

    @Test
    void upsertPersona_Returns403ForNonAdmin() {
        when(principal.getName()).thenReturn(MEMBER_ID);
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(groupConv));

        AiPersonaRequest req = new AiPersonaRequest("Bot", null, "friendly", null);
        ResponseEntity<AiPersonaResponse> response = controller.upsertPersona(CONV_ID, req, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verify(aiPersonaRepository, never()).save(any());
    }

    @Test
    void upsertPersona_Returns403ForDm() {
        Conversation dmConv = Conversation.builder()
            .id(CONV_ID).type("direct")
            .participants(List.of(ADMIN_ID, MEMBER_ID))
            .admins(List.of(ADMIN_ID))
            .build();
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(dmConv));

        AiPersonaRequest req = new AiPersonaRequest("Bot", null, "friendly", null);
        ResponseEntity<AiPersonaResponse> response = controller.upsertPersona(CONV_ID, req, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void upsertPersona_SavesCorrectlyForAdmin() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(groupConv));
        when(aiPersonaRepository.findByConversationId(CONV_ID)).thenReturn(Optional.empty());
        when(aiPersonaRepository.save(any())).thenReturn(persona);

        AiPersonaRequest req = new AiPersonaRequest("DevBot", null, "professional", null);
        ResponseEntity<AiPersonaResponse> response = controller.upsertPersona(CONV_ID, req, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(aiPersonaRepository).save(any(AiPersona.class));
    }

    @Test
    void deletePersona_Returns403ForNonAdmin() {
        when(principal.getName()).thenReturn(MEMBER_ID);
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(groupConv));

        ResponseEntity<Void> response = controller.deletePersona(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verify(aiPersonaRepository, never()).deleteByConversationId(any());
    }

    @Test
    void deletePersona_Returns204ForAdmin() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(groupConv));
        doNothing().when(aiPersonaRepository).deleteByConversationId(CONV_ID);

        ResponseEntity<Void> response = controller.deletePersona(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(aiPersonaRepository).deleteByConversationId(CONV_ID);
    }
}
