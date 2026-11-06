package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.AutoDeleteRequest;
import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.CreateConversationRequest;
import com.platform.chatservice.dto.MembersRequest;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.WallpaperRequest;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AttachmentService;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationEventPublisher;
import com.platform.chatservice.service.ConversationQueryService;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.ConversationUserStateService;
import com.platform.chatservice.service.GroupAdminService;
import com.platform.chatservice.service.MessageNotificationService;
import com.platform.chatservice.service.MessageQueryService;
import com.platform.chatservice.service.MessageService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Wiring of the conversation REST endpoints: identity always comes from the principal, shared
 * changes go to the topic, per-user changes only to the actor's queue, and the right system notice
 * is posted. Authorization itself lives in the services (their own tests).
 */
@ExtendWith(MockitoExtension.class)
class ConversationControllerTest {

  private static final String ME = "me-1";
  private static final String OTHER = "other-1";
  private static final String CONV = "conv-1";

  @Mock private ConversationService conversationService;
  @Mock private GroupAdminService groupAdminService;
  @Mock private ConversationUserStateService userStateService;
  @Mock private ConversationQueryService conversationQueryService;
  @Mock private MessageService messageService;
  @Mock private MessageQueryService messageQueryService;
  @Mock private AttachmentService attachmentService;
  @Mock private ClusterMessageBroker clusterBroker;
  @Mock private ConversationEventPublisher events;
  @Mock private MessageNotificationService notificationService;

  @InjectMocks private ConversationController controller;

  @BeforeEach
  void setUp() {
    SecurityContextHolder.getContext().setAuthentication(new UserPrincipal(ME));
  }

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  private static ConversationResponse view() {
    return new ConversationResponse(
        CONV,
        "group",
        "Team",
        null,
        List.of(ME, OTHER),
        List.of(ME),
        ME,
        null,
        null,
        null,
        0L,
        Instant.now(),
        "accepted",
        false,
        List.of(),
        false,
        false,
        null,
        false,
        null,
        List.of(),
        null,
        null);
  }

  private MessageResponse notice(String content) {
    return new MessageResponse("sys", CONV, ME, content, "system", List.of(ME), Instant.now());
  }

  private void expectNotice(String content) {
    when(messageService.createSystemMessage(CONV, content)).thenReturn(notice(content));
  }

  private void verifyNotice(String content) {
    ArgumentCaptor<MessageResponse> sent = ArgumentCaptor.forClass(MessageResponse.class);
    verify(clusterBroker).convertAndSend(eq("/topic/conversation/" + CONV), sent.capture());
    assertThat(sent.getValue().content()).isEqualTo(content);
    verify(notificationService).notifySystemNotice(ME, sent.getValue());
  }

  @Test
  void anonymousCallerIsRejectedBeforeAnyService() {
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken("x", "y"));
    assertThatThrownBy(() -> controller.getConversation(CONV))
        .isInstanceOf(UnauthorizedException.class);
    SecurityContextHolder.clearContext();
    assertThatThrownBy(() -> controller.deleteConversation(CONV))
        .isInstanceOf(UnauthorizedException.class);
    verifyNoInteractions(conversationService, userStateService);
  }

  @Test
  void createDirectUsesPrincipalAsCreator() {
    ConversationResponse v = view();
    when(conversationService.createConversation(ME, OTHER)).thenReturn(v);
    assertThat(controller.createConversation(new CreateConversationRequest(OTHER))).isSameAs(v);
  }

  @Test
  void removeMember_kickedUserGetsViewOnOwnQueue_andRemovedNotice() {
    ConversationResponse v = view();
    when(conversationService.removeMember(ME, CONV, OTHER)).thenReturn(v);
    expectNotice("system.member.removed");

    controller.removeMember(CONV, OTHER);

    verify(events).publishShared(v);
    // The kicked user no longer receives topic frames, so they get it on their own queue.
    verify(events).publishToUser(eq(OTHER), any(ConversationResponse.class));
    verifyNotice("system.member.removed");
  }

  @Test
  void removeMember_selfIsLeaveNotice() {
    when(conversationService.removeMember(ME, CONV, ME)).thenReturn(view());
    expectNotice("system.member.left");
    controller.removeMember(CONV, ME);
    verifyNotice("system.member.left");
  }

  @Test
  void addMembers_broadcastsSharedAndNotice() {
    ConversationResponse v = view();
    when(conversationService.addMembers(ME, CONV, List.of(OTHER))).thenReturn(v);
    expectNotice("system.members.added");
    assertThat(controller.addMembers(CONV, new MembersRequest(List.of(OTHER)))).isSameAs(v);
    verify(events).publishShared(v);
    verifyNotice("system.members.added");
  }

  @Test
  void joinChannel_broadcastsJoinedNotice() {
    ConversationResponse v = view();
    when(conversationService.joinChannel(ME, CONV)).thenReturn(v);
    expectNotice("system.member.joined");
    controller.joinChannel(CONV);
    verify(events).publishShared(v);
    verifyNotice("system.member.joined");
  }

  @Test
  void settings_realChangeAnnouncesSeconds_noChangeIsSilent() {
    ConversationResponse v = view();
    when(conversationService.setAutoDelete(ME, CONV, 3600))
        .thenReturn(new ConversationService.AutoDeleteChange(v, true, 3600));
    expectNotice("system.autodelete.changed:3600");
    assertThat(controller.updateSettings(CONV, new AutoDeleteRequest(3600))).isSameAs(v);
    verify(events).publishShared(v);
    verifyNotice("system.autodelete.changed:3600");
  }

  @Test
  void settings_noChangeHasNoSideEffects() {
    ConversationResponse v = view();
    when(conversationService.setAutoDelete(ME, CONV, 0))
        .thenReturn(new ConversationService.AutoDeleteChange(v, false, 0));
    controller.updateSettings(CONV, new AutoDeleteRequest(0));
    verifyNoInteractions(events, clusterBroker, messageService, notificationService);
  }

  @Test
  void perUserStateChangesGoOnlyToTheActor() {
    ConversationResponse v = view();
    when(userStateService.mute(ME, CONV, -1L)).thenReturn(v);
    when(userStateService.mute(ME, CONV, 600L)).thenReturn(v);
    when(userStateService.unmute(ME, CONV)).thenReturn(v);
    when(userStateService.archive(ME, CONV)).thenReturn(v);
    when(userStateService.unarchive(ME, CONV)).thenReturn(v);
    when(userStateService.blockArchive(ME, CONV)).thenReturn(v);
    when(userStateService.blockRestore(ME, CONV)).thenReturn(v);
    when(userStateService.markUnread(ME, CONV)).thenReturn(v);
    when(userStateService.markRead(ME, CONV)).thenReturn(v);

    controller.muteConversation(CONV, null);
    controller.muteConversation(CONV, new ConversationController.MuteDurationRequest(null));
    controller.muteConversation(CONV, new ConversationController.MuteDurationRequest(600L));
    controller.unmuteConversation(CONV);
    controller.archiveConversation(CONV);
    controller.unarchiveConversation(CONV);
    controller.blockArchive(CONV);
    controller.blockRestore(CONV);
    controller.markConversationUnread(CONV);
    controller.markConversationRead(CONV);

    verify(events, org.mockito.Mockito.times(10)).publishToUser(ME, v);
    verify(events, never()).publishShared(any(ConversationResponse.class));
    verify(userStateService, org.mockito.Mockito.times(2)).mute(ME, CONV, -1L);
  }

  @Test
  void clearHistoryNotifiesOnlyTheActor() {
    ConversationResponse v = view();
    when(userStateService.clearHistory(ME, CONV)).thenReturn(v);
    controller.clearHistory(CONV);
    verify(events).publishToUser(ME, v);
    verify(events, never()).publishShared(any(ConversationResponse.class));
  }

  @Test
  void acceptAndWallpaperAreShared() {
    ConversationResponse v = view();
    when(conversationService.acceptConversation(ME, CONV)).thenReturn(v);
    when(conversationService.setWallpaper(ME, CONV, "w1")).thenReturn(v);
    controller.acceptConversation(CONV);
    controller.setWallpaper(CONV, new WallpaperRequest("w1"));
    verify(events, org.mockito.Mockito.times(2)).publishShared(v);
    verifyNoInteractions(messageService);
  }

  @Test
  void listRoutesBlockedSectionSeparately() {
    PageResponse<ConversationResponse> page = new PageResponse<>(List.of(), 0, 20, 0);
    when(conversationQueryService.listBlockedConversations(eq(ME), any(Pageable.class)))
        .thenReturn(page);
    assertThat(controller.listConversations(0, 20, false, true, false)).isSameAs(page);
    verify(conversationQueryService, never())
        .listConversations(
            anyString(),
            any(Pageable.class),
            org.mockito.ArgumentMatchers.anyBoolean(),
            org.mockito.ArgumentMatchers.anyBoolean());

    when(conversationQueryService.listConversations(
            eq(ME), any(Pageable.class), eq(true), eq(true)))
        .thenReturn(page);
    assertThat(controller.listConversations(0, 500, true, false, true)).isSameAs(page);
    ArgumentCaptor<Pageable> p = ArgumentCaptor.forClass(Pageable.class);
    verify(conversationQueryService).listConversations(eq(ME), p.capture(), eq(true), eq(true));
    assertThat(p.getValue().getPageSize()).isEqualTo(100);
  }

  @Test
  void messages_afterParamUsesCatchUp_andRejectsGarbage() {
    PageResponse<MessageResponse> page = new PageResponse<>(List.of(), 0, 50, 0);
    Instant at = Instant.parse("2026-11-06T10:00:00Z");
    when(messageQueryService.getMessagesSince(ME, CONV, at, "m9")).thenReturn(page);
    assertThat(controller.getMessages(CONV, null, " 2026-11-06T10:00:00Z ", "m9", 20))
        .isSameAs(page);

    assertThatThrownBy(() -> controller.getMessages(CONV, null, "yesterday", null, 20))
        .isInstanceOfSatisfying(
            BadRequestException.class,
            e -> assertThat(e.getCode()).isEqualTo(ErrorCodes.INVALID_PARAMETER));
  }

  @Test
  void messages_blankAfterFallsBackToCursorPaging() {
    PageResponse<MessageResponse> page = new PageResponse<>(List.of(), 0, 20, 0);
    when(messageQueryService.getMessages(eq(ME), eq(CONV), eq("m1"), eq(20))).thenReturn(page);
    assertThat(controller.getMessages(CONV, "m1", " ", null, 20)).isSameAs(page);
    verify(messageQueryService, never()).getMessagesSince(any(), any(), any(), any());
  }
}
