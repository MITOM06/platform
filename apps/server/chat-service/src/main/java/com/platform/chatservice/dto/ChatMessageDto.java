package com.platform.chatservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageDto {

    private String conversationId;
    
    private String content;
    
    private String type; // "text" | "image"

    private Boolean typing;

    private String messageId;
}