package com.platform.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    private String id;

    private String conversationId;

    private String senderId;

    private String content;

    @Builder.Default
    private String type = "text";

    @Builder.Default
    private List<String> readBy = new ArrayList<>();

    @CreatedDate
    private Instant createdAt;
}
