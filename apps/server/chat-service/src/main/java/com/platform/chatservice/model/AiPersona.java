package com.platform.chatservice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "ai_personas")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiPersona {

    @Id
    private String id;

    @Indexed(unique = true)
    private String conversationId;

    @Builder.Default
    private String name = "PON AI";

    private String avatarUrl;

    @Builder.Default
    private String tone = "friendly";

    private String systemPromptPrefix;

    private String createdBy;

    @LastModifiedDate
    private Instant updatedAt;
}
