package ws

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Thời gian chờ để ghi message
	writeWait = 10 * time.Second

	// Thời gian chờ giữa các pong message từ peer
	pongWait = 60 * time.Second

	// Gửi ping đến peer trong khoảng thời gian này. Phải nhỏ hơn pongWait
	pingPeriod = (pongWait * 9) / 10

	// Kích thước tối đa của message được phép
	maxMessageSize = 512 * 1024 // 512 KB
)

// Client đại diện cho một WebSocket client
type Client struct {
	// Hub quản lý client
	Hub *Hub

	// WebSocket connection
	Conn *websocket.Conn

	// Channel gửi message đến client
	Send chan []byte

	// ID của user
	UserID string

	// Tên của user
	UserName string

	// Danh sách các room mà client đang tham gia
	Rooms map[string]bool

	// Metadata bổ sung
	Metadata map[string]interface{}
}

// NewClient tạo một client mới
func NewClient(hub *Hub, conn *websocket.Conn, userID, userName string) *Client {
	return &Client{
		Hub:      hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		UserID:   userID,
		UserName: userName,
		Rooms:    make(map[string]bool),
		Metadata: make(map[string]interface{}),
	}
}

// ReadPump đọc message từ WebSocket connection
// Chạy trong một goroutine riêng
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse message
		var msg Message
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			log.Printf("Error parsing message: %v", err)
			c.SendError("INVALID_MESSAGE", "Invalid message format")
			continue
		}

		// Set sender info
		msg.SenderID = c.UserID
		msg.SenderName = c.UserName
		msg.Timestamp = time.Now()

		// Xử lý message dựa trên type
		c.HandleMessage(&msg)
	}
}

// WritePump gửi message đến WebSocket connection
// Chạy trong một goroutine riêng
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub đã đóng channel
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Thêm các message đang chờ vào current WebSocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// HandleMessage xử lý message dựa trên loại
func (c *Client) HandleMessage(msg *Message) {
	switch msg.Type {
	case MessageTypeText, MessageTypeImage, MessageTypeFile:
		c.Hub.PublishMessage(msg)
	case MessageTypeTyping:
		// Xử lý typing indicator
		c.HandleTyping(msg)

	case MessageTypeRead:
		// Xử lý read receipt
		c.HandleReadReceipt(msg)

	case MessageTypeJoin:
		// Tham gia room
		c.JoinRoom(msg.RoomID)

	case MessageTypeLeave:
		// Rời khỏi room
		c.LeaveRoom(msg.RoomID)

	case MessageTypeHeartbeat:
		// Heartbeat - không làm gì cả
		log.Printf("Received heartbeat from user %s", c.UserID)

	default:
		c.SendError("UNKNOWN_MESSAGE_TYPE", "Unknown message type")
	}
}

// HandleTyping xử lý typing indicator
func (c *Client) HandleTyping(msg *Message) {
	typingData := map[string]interface{}{
		"type":     MessageTypeTyping,
		"userId":   c.UserID,
		"userName": c.UserName,
		"roomId":   msg.RoomID,
		"isTyping": true,
	}

	if metadata, ok := msg.Metadata["isTyping"].(bool); ok {
		typingData["isTyping"] = metadata
	}

	data, _ := json.Marshal(typingData)

	// Broadcast đến room (trừ chính người gửi)
	c.Hub.BroadcastToRoomExcept(msg.RoomID, data, c.UserID)
}

// HandleReadReceipt xử lý read receipt
func (c *Client) HandleReadReceipt(msg *Message) {
	receiptData := map[string]interface{}{
		"type":      MessageTypeRead,
		"userId":    c.UserID,
		"messageId": msg.Metadata["messageId"],
		"roomId":    msg.RoomID,
		"readAt":    time.Now(),
	}

	data, _ := json.Marshal(receiptData)

	// Broadcast đến room
	c.Hub.BroadcastToRoomExcept(msg.RoomID, data, c.UserID)
}

// JoinRoom thêm client vào room
func (c *Client) JoinRoom(roomID string) {
	if roomID == "" {
		return
	}

	c.Rooms[roomID] = true
	c.Hub.JoinRoom(roomID, c)

	// Gửi system message
	systemMsg := Message{
		Type:      MessageTypeSystem,
		Content:   c.UserName + " joined the room",
		RoomID:    roomID,
		Timestamp: time.Now(),
	}

	data, _ := json.Marshal(systemMsg)
	c.Hub.BroadcastToRoomExcept(roomID, data, c.UserID)

	log.Printf("User %s joined room %s", c.UserID, roomID)
}

func (c *Client) LeaveRoom(roomID string) {
	if !c.Rooms[roomID] {
		return
	}

	delete(c.Rooms, roomID)
	c.Hub.LeaveRoom(roomID, c)

	systemMsg := Message{
		Type:      MessageTypeSystem,
		Content:   c.UserName + " left the room",
		RoomID:    roomID,
		Timestamp: time.Now(),
	}

	c.Hub.BroadcastToRoom <- &systemMsg

	log.Printf("User %s left room %s", c.UserID, roomID)
}

func (c *Client) SendMessage(data []byte) {
	select {
	case c.Send <- data:
	default:

		close(c.Send)
	}
}

// SendError gửi error message đến client
func (c *Client) SendError(code, message string) {
	errMsg := map[string]interface{}{
		"type":    MessageTypeError,
		"code":    code,
		"message": message,
	}
	data, _ := json.Marshal(errMsg)
	c.SendMessage(data)
}

// Close đóng connection
func (c *Client) Close() {
	// Rời khỏi tất cả các room
	for roomID := range c.Rooms {
		c.LeaveRoom(roomID)
	}

	c.Conn.Close()
	close(c.Send)
}
