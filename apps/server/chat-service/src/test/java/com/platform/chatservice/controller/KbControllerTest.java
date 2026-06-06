package com.platform.chatservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.KbDocumentResponse;
import com.platform.chatservice.dto.KbUploadRequest;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.KbDocument;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.KbDocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KbControllerTest {

    @Mock private KbDocumentRepository kbDocumentRepository;
    @Mock private ConversationRepository conversationRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ObjectMapper objectMapper;
    @Mock private Principal principal;

    @InjectMocks private KbController controller;

    private static final String USER_ID = "user-001";
    private static final String CONV_ID = "conv-001";
    private static final String DOC_ID = "doc-uuid-001";

    private Conversation conversation;
    private KbDocument document;

    @BeforeEach
    void setUp() throws Exception {
        when(principal.getName()).thenReturn(USER_ID);

        conversation = new Conversation();
        conversation.setId(CONV_ID);
        conversation.setParticipants(List.of(USER_ID, "user-002"));

        document = KbDocument.builder()
            .id("id-1")
            .documentId(DOC_ID)
            .conversationId(CONV_ID)
            .userId(USER_ID)
            .fileName("test.pdf")
            .mimeType("application/pdf")
            .fileUrl("http://localhost/test.pdf")
            .status("pending")
            .chunkCount(0)
            .uploadedAt(Instant.now())
            .build();

        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(redisTemplate.convertAndSend(anyString(), anyString())).thenReturn(null);
    }

    @Test
    void uploadDocument_CreatesDocumentAndPublishesToRedis() throws Exception {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(kbDocumentRepository.save(any())).thenReturn(document);

        KbUploadRequest req = new KbUploadRequest();
        req.setConversationId(CONV_ID);
        req.setFileName("test.pdf");
        req.setMimeType("application/pdf");
        req.setFileUrl("http://localhost/test.pdf");

        ResponseEntity<KbDocumentResponse> response = controller.uploadDocument(req, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        verify(kbDocumentRepository).save(any(KbDocument.class));
        verify(redisTemplate).convertAndSend(eq("kb:process"), anyString());
    }

    @Test
    void uploadDocument_ThrowsForbiddenWhenNotParticipant() {
        Conversation otherConv = new Conversation();
        otherConv.setId(CONV_ID);
        otherConv.setParticipants(List.of("other-user"));
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(otherConv));

        KbUploadRequest req = new KbUploadRequest();
        req.setConversationId(CONV_ID);
        req.setFileName("test.pdf");
        req.setMimeType("application/pdf");
        req.setFileUrl("http://localhost/test.pdf");

        assertThatThrownBy(() -> controller.uploadDocument(req, principal))
            .isInstanceOf(ForbiddenException.class);
        verify(kbDocumentRepository, never()).save(any());
    }

    @Test
    void getDocuments_ReturnsDocumentList() {
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
        when(kbDocumentRepository.findByConversationIdOrderByUploadedAtDesc(CONV_ID))
            .thenReturn(List.of(document));

        ResponseEntity<List<KbDocumentResponse>> response =
            controller.getDocuments(CONV_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
        assertThat(response.getBody().get(0).fileName()).isEqualTo("test.pdf");
    }

    @Test
    void deleteDocument_Returns204AndPublishesKbDelete() throws Exception {
        when(kbDocumentRepository.findByDocumentId(DOC_ID)).thenReturn(Optional.of(document));
        when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

        ResponseEntity<Void> response = controller.deleteDocument(DOC_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(kbDocumentRepository).deleteByDocumentId(DOC_ID);
        verify(redisTemplate).convertAndSend(eq("kb:delete"), anyString());
    }

    @Test
    void deleteDocument_Returns404WhenNotFound() throws Exception {
        when(kbDocumentRepository.findByDocumentId(DOC_ID)).thenReturn(Optional.empty());

        ResponseEntity<Void> response = controller.deleteDocument(DOC_ID, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        verify(kbDocumentRepository, never()).deleteByDocumentId(any());
    }
}
