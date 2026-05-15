---
name: spring-boot-service
description: Create a Spring Boot service layer: Controller + Service + Repository + DTO pattern
---

Create Spring Boot component for: $ARGUMENTS

Pattern to follow for this project:

**Entity** (`@Document` collection):
```java
@Document(collection = "messages")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Message {
    @Id private String id;
    private String conversationId;
    private String senderId;
    // ...
    @CreatedDate private Instant createdAt;
}
```

**Repository** (Spring Data MongoDB):
```java
public interface MessageRepository extends MongoRepository<Message, String> {
    Page<Message> findByConversationIdOrderByCreatedAtDesc(String conversationId, Pageable pageable);
}
```

**DTO** (request/response separation):
```java
public record SendMessageRequest(String conversationId, String content, String type) {}
public record MessageResponse(String id, String senderId, String content, Instant createdAt) {}
```

**Service** (business logic):
```java
@Service
@RequiredArgsConstructor
public class MessageService {
    private final MessageRepository messageRepository;
    // constructor injection via @RequiredArgsConstructor (Lombok)
}
```

**Controller**:
```java
@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {
    private final MessageService messageService;
}
```

IMPORTANT: Use `jakarta.*` not `javax.*`. Use constructor injection. Separate DTO from entity.
