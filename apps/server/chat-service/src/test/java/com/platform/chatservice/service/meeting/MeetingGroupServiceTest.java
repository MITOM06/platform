package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationCacheService;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.MessageNotificationService;
import com.platform.chatservice.service.MessageService;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class MeetingGroupServiceTest {

  private final MeetingStore store = mock(MeetingStore.class);
  private final ConversationService conversationService = mock(ConversationService.class);
  private final ConversationRepository repo = mock(ConversationRepository.class);
  private final ConversationCacheService cache = mock(ConversationCacheService.class);
  private final MeetingGroupService service =
      new MeetingGroupService(
          store,
          conversationService,
          repo,
          mock(MessageService.class),
          mock(ClusterMessageBroker.class),
          mock(MessageNotificationService.class),
          cache);

  @Test
  void anOrphanGroupLostToARacingWriterIsDeletedAndEvictedFromTheCache() {
    Meeting m =
        Meeting.builder().id("m1").hostId("host").inviteeIds(new ArrayList<>(List.of("a"))).build();
    ConversationResponse created = mock(ConversationResponse.class);
    when(created.id()).thenReturn("orphan");
    when(conversationService.createMeetingGroup(anyString(), anyString(), anyList(), anyString()))
        .thenReturn(created);
    when(store.setGroupConversation("m1", "orphan")).thenReturn(false);
    when(store.findById("m1"))
        .thenReturn(Optional.of(Meeting.builder().id("m1").groupConversationId("winner").build()));

    assertThat(service.ensureGroup(m)).contains("winner");

    InOrder order = inOrder(repo, cache);
    order.verify(repo).deleteById("orphan");
    order.verify(cache).evict("orphan");
  }
}
