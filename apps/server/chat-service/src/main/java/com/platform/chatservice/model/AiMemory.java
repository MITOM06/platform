package com.platform.chatservice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "ai_memories")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiMemory {

    @Id
    private String id;

    @Indexed
    private String conversationId;

    @Indexed
    private String userId;

    private String summary;

    private List<String> keyFacts;

    private Integer messageCount;

    private Instant updatedAt;
}
