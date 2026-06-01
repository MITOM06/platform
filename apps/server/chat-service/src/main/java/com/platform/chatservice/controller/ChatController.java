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

@SuppressWarnings("null")
@Controller
@RequiredArgsConstructor
public class ChatController {

    private final MessageService messageService;
    private final ConversationService conversationService;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.platform.chatservice.service.FcmService fcmService;

    @MessageMapping("/chat.send")
    public void send(@Payload ChatMessageDto dto, Principal principal) {
        SendMessageRequest request = new SendMessageRequest(
                dto.getConversationId(),
                dto.getContent(),
                dto.getType(),
                dto.getReplyToId()
        );
        MessageResponse response = messageService.sendMessage(principal.getName(), request);
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + dto.getConversationId(),
                response
        );

        List<String> mentions = response.mentions() == null ? List.of() : response.mentions();
        List<String> participants = conversationService.getParticipants(dto.getConversationId());
        for (String participantId : participants) {
            if (!participantId.equals(principal.getName())) {
                // Mentioned participants get a priority MENTIONED_YOU event instead
                // of the generic NEW_MESSAGE so the client can surface it specially.
                boolean mentioned = mentions.contains(participantId);
                Map<String, String> notification = Map.of(
                    "type", mentioned ? "MENTIONED_YOU" : "NEW_MESSAGE",
                    "conversationId", dto.getConversationId(),
                    "senderName", principal.getName()
                );
                messagingTemplate.convertAndSendToUser(participantId, "/queue/notifications", notification);

                // Trigger Push Notification
                fcmService.sendPushNotification(participantId, principal.getName(), dto.getContent(), dto.getConversationId());
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

    // WebRTC Signaling Endpoints
    @MessageMapping("/call.offer")
    public void callOffer(@Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
        dto.setSenderId(principal.getName());
        messagingTemplate.convertAndSendToUser(dto.getTargetId(), "/queue/webrtc", dto);
    }

    @MessageMapping("/call.answer")
    public void callAnswer(@Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
        dto.setSenderId(principal.getName());
        messagingTemplate.convertAndSendToUser(dto.getTargetId(), "/queue/webrtc", dto);
    }

    @MessageMapping("/call.ice")
    public void callIceCandidate(@Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
        dto.setSenderId(principal.getName());
        messagingTemplate.convertAndSendToUser(dto.getTargetId(), "/queue/webrtc", dto);
    }

    @MessageMapping("/call.end")
    public void callEnd(@Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
        dto.setSenderId(principal.getName());
        // Notify the other peer
        messagingTemplate.convertAndSendToUser(dto.getTargetId(), "/queue/webrtc", dto);

        // Save call log
        String content = "Call ended";
        if (dto.getDuration() != null && dto.getDuration() > 0) {
            int minutes = dto.getDuration() / 60;
            int seconds = dto.getDuration() % 60;
            content = String.format("Call ended - %02d:%02d", minutes, seconds);
        } else {
            content = "Missed call";
        }

        SendMessageRequest logRequest = new SendMessageRequest(
                dto.getConversationId(),
                content,
                "call_log",
                null
        );
        MessageResponse response = messageService.sendMessage(principal.getName(), logRequest);
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + dto.getConversationId(),
                response
        );
    }
}
