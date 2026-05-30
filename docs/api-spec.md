# API Specification — chat-service (Spring Boot)

Base URL: `http://localhost:8080`  
Auth: `Authorization: Bearer <jwt_token>` (required on all endpoints except /health)

---

## Health

```
GET /health
Response: { "status": "ok", "service": "chat-service" }
```

---

## Conversations

### List conversations
```
GET /api/conversations
Auth: required
Response 200:
{
  "content": [
    {
      "id": "string",
      "participants": ["userId1", "userId2"],
      "lastMessage": { "content": "string", "senderId": "string", "createdAt": "ISO8601" },
      "lastMessageAt": "ISO8601",
      "unreadCount": 0,
      "createdAt": "ISO8601"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 5
}
```

### Create conversation (1-on-1)
```
POST /api/conversations
Auth: required
Body: { "participantId": "string" }
Response 201: { "id": "string", "participants": [...], "createdAt": "ISO8601" }
Response 409: { "error": "Conversation already exists", "conversationId": "string" }
```

### Get single conversation
```
GET /api/conversations/{id}
Auth: required
Response 200: Conversation object
Response 404: { "error": "Not found" }
```

---

## Messages

### Get messages (paginated)
```
GET /api/conversations/{conversationId}/messages?page=0&size=20
Auth: required
Response 200:
{
  "content": [
    {
      "id": "string",
      "conversationId": "string",
      "senderId": "string",
      "content": "string",
      "type": "text | image",
      "readBy": ["userId1"],
      "createdAt": "ISO8601"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 100
}
Note: sorted by createdAt DESC (newest first for pagination, reverse display)
```

### Send message (REST fallback)
```
POST /api/messages
Auth: required
Body: { "conversationId": "string", "content": "string", "type": "text" }
Response 201: Message object
```

### Mark as read
```
PUT /api/messages/{id}/read
Auth: required
Response 200: { "success": true }
```

---

## Users (auth-service — port 3001)

### Search users
```
GET /api/users/search?q={query}
Auth: required (Bearer token → auth-service)
Response 200: [ { "_id": "string", "email": "string", "displayName": "string" }, ... ]
Note: regex match email OR displayName, limit 10, password field excluded
```

### Get user profile
```
GET /api/users/{id}
Auth: required
Response 200: { "_id": "string", "email": "string", "displayName": "string", "avatarUrl": "string|null" }
```

### Get current user
```
GET /api/users/me
Auth: required
Response 200: same as above for authenticated user
```

---

## User Presence (chat-service — port 8080)

### Get user status
```
GET /api/users/{userId}/status
Auth: required
Response 200: { "userId": "string", "online": true }
Note: online=false khi Redis key không tồn tại (TTL 5 phút, refresh mỗi STOMP frame)
```

---

## WebSocket (STOMP)

### Connect
```
Endpoint: ws://localhost:8080/ws
Protocol: STOMP over raw WebSocket (KHÔNG dùng SockJS — stomp_dart_client không support)
Spring Boot config: registry.addEndpoint("/ws").setAllowedOrigins("*")  ← KHÔNG .withSockJS()
Headers: { "Authorization": "Bearer <token>" }
```

### Client → Server (send)
```
STOMP destination: /app/chat.send
Body: { "conversationId": "string", "content": "string", "type": "text" }
```

### Client → Server (typing)
```
STOMP destination: /app/chat.typing
Body: { "conversationId": "string", "typing": true }
```

### Server → Client (subscribe)
```
New messages:     /topic/conversation/{conversationId}
  Payload: Message object

Typing indicator: /topic/conversation/{conversationId}/typing
  Payload: { "userId": "string", "typing": true }

Personal notifs:  /user/queue/notifications
  Payload: { "type": "NEW_MESSAGE", "conversationId": "string", "senderName": "string" }
```

---

## Error Response Format (chuẩn)
```json
{
  "error": "string",
  "message": "string",
  "statusCode": 400
}
```

---

## Data Models

### Conversation (MongoDB `conversations` collection)
```json
{
  "_id": "ObjectId",
  "participants": ["userId1", "userId2"],
  "lastMessage": { "content": "...", "senderId": "...", "createdAt": "..." },
  "lastMessageAt": "ISODate",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### Message (MongoDB `messages` collection)
```json
{
  "_id": "ObjectId",
  "conversationId": "string",
  "senderId": "string",
  "content": "string",
  "type": "text",
  "readBy": ["userId1"],
  "createdAt": "ISODate"
}
```
