package com.platform.chatservice.controller;

import com.platform.chatservice.dto.ChatMessageDto;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final MessageService messageService;
    private final ConversationService conversationService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    public void send(@Payload ChatMessageDto dto, Principal principal) {
        SendMessageRequest request = new SendMessageRequest(
                dto.getConversationId(),
                dto.getContent(),
                dto.getType()
        );
        MessageResponse response = messageService.sendMessage(principal.getName(), request);
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + dto.getConversationId(),
                response
        );

        Map<String, String> notification = Map.of(
            "type", "NEW_MESSAGE",
            "conversationId", dto.getConversationId(),
            "senderName", principal.getName()
        );
        List<String> participants = conversationService.getParticipants(dto.getConversationId());
        for (String participantId : participants) {
            if (!participantId.equals(principal.getName())) {
                messagingTemplate.convertAndSendToUser(participantId, "/queue/notifications", notification);
            }
        }
    }

    @MessageMapping("/chat.typing")
    public void typing(@Payload ChatMessageDto dto, Principal principal) {
        Map<String, Object> payload = Map.of(
                "conversationId", dto.getConversationId(),
                "userId", principal.getName(),
                "typing", Boolean.TRUE.equals(dto.getTyping())
        );
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + dto.getConversationId() + "/typing",
                payload
        );
    }

    @MessageMapping("/chat.read")
    public void markRead(@Payload ChatMessageDto dto, Principal principal) {
        messageService.markAsRead(principal.getName(), dto.getMessageId());
        Map<String, String> event = Map.of(
                "type", "MESSAGE_READ",
                "messageId", dto.getMessageId(),
                "readerId", principal.getName()
        );
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + dto.getConversationId(),
                event
        );
    }
}
