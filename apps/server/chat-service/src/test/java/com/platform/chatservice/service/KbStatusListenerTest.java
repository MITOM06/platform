package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.model.KbDocument;
import com.platform.chatservice.repository.KbDocumentRepository;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.connection.DefaultMessage;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class KbStatusListenerTest {

  private final KbDocumentRepository repo = mock(KbDocumentRepository.class);
  private final SimpMessagingTemplate ws = mock(SimpMessagingTemplate.class);
  private final KbStatusListener listener = new KbStatusListener(repo, ws, new ObjectMapper());

  private void send(String json) {
    listener.onMessage(
        new DefaultMessage(
            "kb:status:x".getBytes(StandardCharsets.UTF_8), json.getBytes(StandardCharsets.UTF_8)),
        null);
  }

  private KbDocument stored() {
    KbDocument doc = KbDocument.builder().documentId("d1").conversationId("c1").build();
    when(repo.findByDocumentId("d1")).thenReturn(Optional.of(doc));
    return doc;
  }

  @Test
  @SuppressWarnings("unchecked")
  void doneMarksDocumentAndNotifiesConversation() {
    KbDocument doc = stored();
    send("{\"type\":\"KB_DONE\",\"documentId\":\"d1\",\"conversationId\":\"c1\",\"chunkCount\":7}");

    assertThat(doc.getStatus()).isEqualTo("done");
    assertThat(doc.getChunkCount()).isEqualTo(7);
    verify(repo).save(doc);
    ArgumentCaptor<Object> event = ArgumentCaptor.forClass(Object.class);
    verify(ws).convertAndSend(eq("/topic/conversation/c1"), event.capture());
    assertThat((Map<String, Object>) event.getValue())
        .containsExactlyInAnyOrderEntriesOf(
            Map.of(
                "type", "KB_STATUS_UPDATE", "documentId", "d1", "status", "done", "chunkCount", 7));
  }

  @Test
  void doneWithoutChunkCountOrConversationSavesZeroAndSendsNothing() {
    KbDocument doc = stored();
    doc.setChunkCount(3);
    send("{\"type\":\"KB_DONE\",\"documentId\":\"d1\"}");
    assertThat(doc.getStatus()).isEqualTo("done");
    assertThat(doc.getChunkCount()).isZero();
    verify(repo).save(doc);
    verifyNoInteractions(ws);
  }

  @Test
  @SuppressWarnings("unchecked")
  void errorMarksDocumentAndNotifies() {
    KbDocument doc = stored();
    send("{\"type\":\"KB_ERROR\",\"documentId\":\"d1\",\"conversationId\":\"c1\"}");
    assertThat(doc.getStatus()).isEqualTo("error");
    ArgumentCaptor<Object> event = ArgumentCaptor.forClass(Object.class);
    verify(ws).convertAndSend(eq("/topic/conversation/c1"), event.capture());
    assertThat((Map<String, Object>) event.getValue()).containsEntry("status", "error");
  }

  @Test
  void errorWithoutConversationOnlySaves() {
    KbDocument doc = stored();
    send("{\"type\":\"KB_ERROR\",\"documentId\":\"d1\"}");
    verify(repo).save(doc);
    verifyNoInteractions(ws);
  }

  @Test
  void unknownDocumentMissingIdOrUnknownTypeChangeNothing() {
    when(repo.findByDocumentId("ghost")).thenReturn(Optional.empty());
    send("{\"type\":\"KB_DONE\",\"documentId\":\"ghost\",\"conversationId\":\"c1\"}");
    send("{\"type\":\"KB_DONE\",\"conversationId\":\"c1\"}");
    stored();
    send("{\"type\":\"KB_PROGRESS\",\"documentId\":\"d1\",\"conversationId\":\"c1\"}");
    verify(repo, never()).save(any());
    verify(ws, never()).convertAndSend(anyString(), any(Object.class));
  }

  @Test
  void malformedPayloadIsSwallowed() {
    send("not json");
    send("{\"type\":\"KB_DONE\",\"documentId\":\"d1\",\"chunkCount\":\"many\"}");
    verify(repo, never()).save(any());
  }
}
