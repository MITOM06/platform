package ws

import "time"

// MessageType định nghĩa các loại message
type MessageType string

const (
	MessageTypeText       MessageType = "text"
	MessageTypeImage      MessageType = "image"
	MessageTypeFile       MessageType = "file"
	MessageTypeTyping     MessageType = "typing"
	MessageTypeRead       MessageType = "read"
	MessageTypeJoin       MessageType = "join"
	MessageTypeLeave      MessageType = "leave"
	MessageTypeSystem     MessageType = "system"
	MessageTypeHeartbeat  MessageType = "heartbeat"
	MessageTypeError      MessageType = "error"
)

// Message đại diện cho một tin nhắn trong hệ thống
type Message struct {
	ID          string                 `json:"id"`
	Type        MessageType            `json:"type"`
	Content     string                 `json:"content"`
	SenderID    string                 `json:"senderId"`
	SenderName  string                 `json:"senderName"`
	RoomID      string                 `json:"roomId"`
	Timestamp   time.Time              `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	ReplyTo     string                 `json:"replyTo,omitempty"`
}

// TypingIndicator đại diện cho trạng thái đang gõ
type TypingIndicator struct {
	UserID   string `json:"userId"`
	UserName string `json:"userName"`
	RoomID   string `json:"roomId"`
	IsTyping bool   `json:"isTyping"`
}

// ReadReceipt đại diện cho xác nhận đã đọc tin nhắn
type ReadReceipt struct {
	UserID    string    `json:"userId"`
	MessageID string    `json:"messageId"`
	RoomID    string    `json:"roomId"`
	ReadAt    time.Time `json:"readAt"`
}

// JoinRoomRequest yêu cầu tham gia phòng chat
type JoinRoomRequest struct {
	RoomID string `json:"roomId"`
}

// LeaveRoomRequest yêu cầu rời khỏi phòng chat
type LeaveRoomRequest struct {
	RoomID string `json:"roomId"`
}

// ErrorMessage tin nhắn lỗi
type ErrorMessage struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// SystemMessage tin nhắn hệ thống
type SystemMessage struct {
	Content string    `json:"content"`
	RoomID  string    `json:"roomId"`
	Time    time.Time `json:"time"`
}