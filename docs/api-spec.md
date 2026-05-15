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

## User Presence

### Get user status
```
GET /api/users/{userId}/status
Auth: required
Response 200: { "userId": "string", "online": true, "lastSeen": "ISO8601" }
```

---

## WebSocket (STOMP)

### Connect
```
Endpoint: ws://localhost:8080/ws
Protocol: STOMP over SockJS
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
  Payload: { "type": "new_conversation | message", "data": {...} }
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
