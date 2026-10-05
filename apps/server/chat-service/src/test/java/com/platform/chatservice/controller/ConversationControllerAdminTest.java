package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.UpdateConversationRequest;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AttachmentService;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationEventPublisher;
import com.platform.chatservice.service.ConversationQueryService;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.ConversationUserStateService;
import com.platform.chatservice.service.GroupAdminService;
import com.platform.chatservice.service.MessageQueryService;
import com.platform.chatservice.service.MessageService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;

/** F4 admin endpoints + F5 public toggle: side effects only on a real change. */
@ExtendWith(MockitoExtension.class)
class ConversationControllerAdminTest {

  private static final String ACTOR = "admin-1";
  private static final String TARGET = "member-1";
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

  @InjectMocks private ConversationController controller;

  @BeforeEach
  void setUp() {
    SecurityContextHolder.getContext().setAuthentication(new UserPrincipal(ACTOR));
  }

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  private static ConversationResponse view(List<String> admins) {
    return new ConversationResponse(
        CONV,
        "group",
        "Team",
        null,
        List.of(ACTOR, TARGET, "other"),
        admins,
        ACTOR,
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
        null);
  }

  private MessageResponse notice(String content) {
    return new MessageResponse(
        "sys-1", CONV, ACTOR, content, "system", List.of(ACTOR), Instant.now());
  }

  @Test
  void promote_realChange_broadcastsSharedUpdateAndActorAttributedNotice() {
    ConversationResponse after = view(List.of(ACTOR, TARGET));
    when(groupAdminService.promote(ACTOR, CONV, TARGET))
        .thenReturn(new GroupAdminService.AdminChange(after, true));
    when(messageService.createSystemMessage(CONV, "system.admin.promoted:" + TARGET, ACTOR))
        .thenReturn(notice("system.admin.promoted:" + TARGET));
    when(conversationQueryService.getParticipants(CONV))
        .thenReturn(List.of(ACTOR, TARGET, "other"));

    ConversationResponse result = controller.promoteAdmin(CONV, TARGET);

    assertThat(result).isSameAs(after);
    verify(events).publishShared(after);
    verify(clusterBroker)
        .convertAndSend(eq("/topic/conversation/" + CONV), any(MessageResponse.class));
    // Every participant but the actor is notified.
    verify(clusterBroker).convertAndSendToUser(eq(TARGET), eq("/queue/notifications"), any());
    verify(clusterBroker).convertAndSendToUser(eq("other"), eq("/queue/notifications"), any());
    verify(clusterBroker, never()).convertAndSendToUser(eq(ACTOR), anyString(), any());
  }

  @Test
  void demote_realChange_postsTheDemotedCode() {
    ConversationResponse after = view(List.of(ACTOR));
    when(groupAdminService.demote(ACTOR, CONV, TARGET))
        .thenReturn(new GroupAdminService.AdminChange(after, true));
    when(messageService.createSystemMessage(CONV, "system.admin.demoted:" + TARGET, ACTOR))
        .thenReturn(notice("system.admin.demoted:" + TARGET));
    when(conversationQueryService.getParticipants(CONV)).thenReturn(List.of(ACTOR));

    assertThat(controller.demoteAdmin(CONV, TARGET)).isSameAs(after);
    verify(events).publishShared(after);
  }

  @Test
  void idempotentNoOp_hasNoSideEffects() {
    ConversationResponse same = view(List.of(ACTOR, TARGET));
    when(groupAdminService.promote(ACTOR, CONV, TARGET))
        .thenReturn(new GroupAdminService.AdminChange(same, false));

    assertThat(controller.promoteAdmin(CONV, TARGET)).isSameAs(same);
    verifyNoInteractions(events, clusterBroker, messageService);
  }

  @Test
  void updateGroup_forwardsThePublicToggle_andBroadcastsShared() {
    ConversationResponse after = view(List.of(ACTOR));
    when(conversationService.updateGroup(ACTOR, CONV, null, null, true)).thenReturn(after);

    controller.updateGroup(CONV, new UpdateConversationRequest(null, null, true));

    verify(events).publishShared(after);
    verifyNoInteractions(clusterBroker);
  }

  // ---------------------------------------------------------------- HTTP routing + error bodies

  private org.springframework.test.web.servlet.MockMvc mvc() {
    // Standalone MockMvc builds a real RequestMappingHandlerMapping: an ambiguous route would throw
    // here exactly like it aborted the production context once.
    return org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new com.platform.chatservice.exception.GlobalExceptionHandler())
        .build();
  }

  @Test
  void routes_promoteIsPost_demoteIsDelete() throws Exception {
    when(groupAdminService.promote(ACTOR, CONV, TARGET))
        .thenReturn(new GroupAdminService.AdminChange(view(List.of(ACTOR, TARGET)), false));
    when(groupAdminService.demote(ACTOR, CONV, TARGET))
        .thenReturn(new GroupAdminService.AdminChange(view(List.of(ACTOR)), false));

    mvc()
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                "/api/conversations/{id}/admins/{userId}", CONV, TARGET))
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath(
                    "$.admins[1]")
                .value(TARGET));
    mvc()
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                "/api/conversations/{id}/admins/{userId}", CONV, TARGET))
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
  }

  @Test
  void lastAdminDemotion_answers409WithTopLevelCode() throws Exception {
    when(groupAdminService.demote(ACTOR, CONV, ACTOR))
        .thenThrow(
            new com.platform.chatservice.exception.ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                com.platform.chatservice.exception.ErrorCodes.LAST_ADMIN_CANNOT_BE_REMOVED,
                "A group needs at least one admin"));

    mvc()
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                "/api/conversations/{id}/admins/{userId}", CONV, ACTOR))
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isConflict())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.code")
                .value("LAST_ADMIN_CANNOT_BE_REMOVED"));
    verifyNoInteractions(events, clusterBroker);
  }
}
