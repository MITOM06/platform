package com.platform.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

/**
 * Read-only view of the {@code users} collection owned by auth-service.
 * chat-service only reads each user's {@code blockedUsers} array to decide
 * whether a message between two users must be rejected (Block User feature).
 */
@Document(collection = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBlock {

    @Id
    private String id;

    private List<String> blockedUsers;
}
