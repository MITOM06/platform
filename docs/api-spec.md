# API Specification — chat-service (Spring Boot)

Base URL: `http://localhost:8080`  
Auth Header: `Authorization: Bearer <jwt_token>` (required on all endpoints except `/health` and `/ws` pre-handshake)

---

## 🏥 Diagnostics & Utility

### Health check
```http
GET /health
Response 200: { "status": "ok", "service": "chat-service" }
```

### Link Preview
```http
GET /api/utils/link-preview?url={encodedUrl}
Response 200: { "title": "string", "description": "string", "imageUrl": "string", "url": "string" }
```

---

## 📂 Conversations (`/api/conversations`)

### List conversations (paginated)
```http
GET /api/conversations
Response 200:
{
  "content": [
    {
      "id": "string",
      "participants": ["userId1", "userId2"],
      "type": "direct | group",
      "name": "string (nullable)",
      "avatarUrl": "string (nullable)",
      "admins": ["userId"],
      "createdBy": "userId",
      "publicChannel": false,
      "status": "pending | accepted",
      "mutedUsers": ["userId"],
      "archivedBy": ["userId"],
      "lastMessage": { "content": "string", "senderId": "string", "createdAt": "ISO8601" },
      "lastMessageAt": "ISO8601",
      "unreadCount": 0
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1
}
```

### Create Direct Conversation
```http
POST /api/conversations
Body: { "participantId": "string" }
Response 201: Conversation object
Response 409: { "error": "Conversation already exists", "conversationId": "string" }
```

### Create Group Chat
```http
POST /api/conversations/group
Body: { "name": "string", "participantIds": ["string", "string"] }
Response 201: Conversation object
```

### Get Single Conversation
```http
GET /api/conversations/{id}
Response 200: Conversation object
Response 404: { "error": "Not found" }
```

### Update Group Metadata (Admins only)
```http
PUT /api/conversations/{id}
Body: { "name": "string (optional)", "avatarUrl": "string (optional)" }
Response 200: Conversation object
```

### Add Members to Group (Admins only)
```http
POST /api/conversations/{id}/members
Body: { "userIds": ["string"] }
Response 200: Conversation object
```

### Remove Member from Group (Admins only)
```http
DELETE /api/conversations/{id}/members/{userId}
Response 200: Conversation object
```

### Delete/Leave Conversation
```http
DELETE /api/conversations/{id}
Response 204: No Content
```

### Clear Chat History (For Me Only)
```http
POST /api/conversations/{id}/clear
Response 204: No Content
```

### Accept Stranger Chat Request
```http
POST /api/conversations/{id}/accept
Response 200: { "success": true }
```

### Mute/Unmute Notifications
```http
POST /api/conversations/{id}/mute
POST /api/conversations/{id}/unmute
Response 200: { "success": true }
```

### Archive/Unarchive Conversation
```http
POST /api/conversations/{id}/archive
POST /api/conversations/{id}/unarchive
Response 200: { "success": true }
```

### Mark Conversation as Read/Unread
```http
POST /api/conversations/{id}/read
POST /api/conversations/{id}/unread
Response 200: { "success": true }
```

### Update Conversation Custom Settings (Auto-delete window)
```http
PUT /api/conversations/{id}/settings
Body: { "autoDeleteSeconds": 0 }
Response 200: Conversation object
```

### List Public Group Channels
```http
GET /api/conversations/public
Response 200: List of Conversation objects (publicChannel=true)
```

### Join Public Group Channel
```http
POST /api/conversations/{id}/join
Response 200: Conversation object
```

### Get Messages (Cursor-based Pagination)
```http
GET /api/conversations/{conversationId}/messages?beforeId={msgId}&beforeTimestamp={ISO}&size=20
Response 200:
{
  "content": [ Message objects ],
  "nextCursorId": "string",
  "hasMore": true
}
```

### Get Conversation Attachments (Shared Gallery)
```http
GET /api/conversations/{id}/attachments?type=media | file | link
Response 200: List of Message objects matching attachment category
```

---

## ✉️ Messages (`/api/messages`)

### Send Message (REST fallback)
```http
POST /api/messages
Body:
{
  "conversationId": "string",
  "content": "string",
  "type": "text | image | video | file | voice | sticker",
  "replyToId": "string (optional)"
}
Response 201: Message object
```

### Edit Message Content
```http
PUT /api/messages/{id}
Body: { "content": "string" }
Response 200: Updated Message object (defines `editedAt`)
```

### Search Messages
```http
GET /api/messages/search?q={query}&conversationId={id}
Response 200: List of Message objects matching query
```

### Mark Single Message as Read
```http
PUT /api/messages/{id}/read
Response 200: { "success": true }
```

### Add Reaction Emoji
```http
POST /api/messages/{id}/reactions
Body: { "emoji": "❤️" }
Response 200: Updated Message object
```

### Remove Reaction Emoji
```http
DELETE /api/messages/{id}/reactions
Body: { "emoji": "❤️" }
Response 200: Updated Message object
```

### Delete/Recall Message (For Everyone)
```http
DELETE /api/messages/{id}
Response 204: No Content
```

### Delete Message For Me Only
```http
POST /api/messages/{id}/delete-for-me
Response 204: No Content
```

### Get AI Message Trace (Reasoning panel)
```http
GET /api/messages/{id}/trace
Response 200: Trace object (thinkingBlocks, toolCalls, token usage details)
```

### Pin/Unpin Message
```http
POST /api/messages/{id}/pin
DELETE /api/messages/{id}/pin
Response 200: Conversation object (with updated pinnedMessages list)
```

### Forward Message
```http
POST /api/messages/{id}/forward
Body: { "targetConversationIds": ["id1", "id2"] }
Response 200: { "success": true }
```

---

## 🤖 AI Customization (`/api/conversations/{id}/ai-persona`)

### Get Workspace AI Persona
```http
GET /api/conversations/{conversationId}/ai-persona
Response 200: AiPersona object or 404
```

### Update/Upsert Workspace AI Persona (Admins only)
```http
PUT /api/conversations/{conversationId}/ai-persona
Body:
{
  "name": "string (max 30)",
  "avatarUrl": "string (optional)",
  "tone": "friendly | professional | concise | creative",
  "systemPromptPrefix": "string (max 500, optional)"
}
Response 200: AiPersona object
```

### Reset Workspace AI Persona (Admins only)
```http
DELETE /api/conversations/{conversationId}/ai-persona
Response 204: No Content (Reverts to global default)
```

---

## 🧠 AI Memory (`/api/ai/memories`)

### Get All AI Memories
```http
GET /api/ai/memories
Response 200: List of AiMemory objects
```

### Get AI Memory for Conversation
```http
GET /api/ai/memories/{conversationId}
Response 200: AiMemory object or 404
```

### Delete AI Memory for Conversation
```http
DELETE /api/ai/memories/{conversationId}
Response 204: No Content
```

---

## 📊 AI Quotas & Token Usage (`/api/usage`)

### Get Token Usage Metrics
```http
GET /api/usage/tokens?days=30
Response 200:
[
  {
    "date": "YYYY-MM-DD",
    "inputTokens": 1200,
    "outputTokens": 800,
    "requestCount": 5,
    "totalTokens": 2000
  }
]
```

---

## 📚 Knowledge Base / RAG (`/api/kb`)

### Upload Knowledge Document
```http
POST /api/kb
Body: Multi-part file (PDF / DOCX / TXT)
Response 201: KbDocument metadata object
```

### List Uploaded Knowledge Documents
```http
GET /api/kb
Response 200: List of KbDocument objects
```

### Delete Knowledge Document
```http
DELETE /api/kb/{documentId}
Response 204: No Content
```

---

## ⏰ Reminders (`/api/reminders`)

### List Reminders
```http
GET /api/reminders
Response 200: List of active User Reminders
```

### Mark Reminder as Completed
```http
PATCH /api/reminders/{id}/done
Response 200: Updated Reminder object
```

### Delete Reminder
```http
DELETE /api/reminders/{id}
Response 204: No Content
```

---

## 📁 File Upload Service (`/api/uploads`)

### Upload Multipart File
```http
POST /api/uploads
Body: Multi-part file (images, video, documents, audio)
Response 201: { "id": "string", "url": "/api/uploads/string", "filename": "string" }
```

### Get File Inline or Download
```http
GET /api/uploads/{id}?download=true
Response 200: Binary stream with Content-Disposition attachment if download=true
```

---

## 👥 User presence (`/api/users`)

### Get User Online Status & Last Seen
```http
GET /api/users/{userId}/status
Response 200: { "userId": "string", "online": true, "lastSeen": "ISO8601 (nullable)" }
```

### Block/Unblock User
```http
POST /api/users/block/{targetId}
POST /api/users/unblock/{targetId}
Response 200: { "success": true }
```

---

## 🔌 WebSocket (STOMP Broker)

**Connection URL:** `ws://localhost:8080/ws`  
**Headers:** `{ "Authorization": "Bearer <accessToken>" }`  

### Client Publishes
- **Send message:** `/app/chat.send`  
  Payload: `{ "conversationId": "string", "content": "string", "type": "text | image | video | file | voice | sticker", "replyToId": "string (optional)" }`
- **Typing indicator:** `/app/chat.typing`  
  Payload: `{ "conversationId": "string", "typing": boolean }`
- **Read indicator:** `/app/chat.read`  
  Payload: `{ "conversationId": "string", "messageId": "string" }`

### Client Subscriptions
- **Conversation Stream:** `/topic/conversation/{conversationId}`  
  Events: Message objects (new, edited, recalled, reactions, AI streaming chunks)
- **Typing Indicator Stream:** `/topic/conversation/{conversationId}/typing`  
  Payload: `{ "userId": "string", "typing": boolean }`
- **User Notifications Queue:** `/user/queue/notifications`  
  Payload: `{ "type": "NEW_MESSAGE", "conversationId": "string", "senderName": "string" }`
