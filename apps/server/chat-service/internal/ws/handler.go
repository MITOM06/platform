package ws

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// CheckOrigin cho phép tất cả origins (trong production nên kiểm tra cẩn thận)
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Handler xử lý WebSocket connections
type Handler struct {
	Hub *Hub
}

// NewHandler tạo Handler mới
func NewHandler(hub *Hub) *Handler {
	return &Handler{
		Hub: hub,
	}
}

// HandleWebSocket xử lý WebSocket connection upgrade
func (h *Handler) HandleWebSocket(c *gin.Context) {
	// Lấy thông tin user từ context (đã được set bởi auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Unauthorized",
		})
		return
	}

	userName, _ := c.Get("userName")
	if userName == nil {
		userName = "Anonymous"
	}

	// Upgrade HTTP connection lên WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Tạo client mới
	client := NewClient(h.Hub, conn, userID.(string), userName.(string))

	// Đăng ký client với hub
	h.Hub.Register <- client

	// Khởi động goroutines để xử lý read/write
	go client.WritePump()
	go client.ReadPump()

	log.Printf("WebSocket connection established for user: %s (%s)", userID, userName)
}

// HandleGetOnlineUsers lấy danh sách users đang online
func (h *Handler) HandleGetOnlineUsers(c *gin.Context) {
	users := h.Hub.GetOnlineUsers()
	c.JSON(http.StatusOK, gin.H{
		"online_users": users,
		"count":        len(users),
	})
}

// HandleGetRoomUsers lấy danh sách users trong room
func (h *Handler) HandleGetRoomUsers(c *gin.Context) {
	roomID := c.Param("roomId")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Room ID is required",
		})
		return
	}

	clients := h.Hub.GetRoomClients(roomID)
	users := make([]map[string]string, len(clients))
	
	for i, client := range clients {
		users[i] = map[string]string{
			"userId":   client.UserID,
			"userName": client.UserName,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"room_id": roomID,
		"users":   users,
		"count":   len(users),
	})
}

// HandleCheckUserStatus kiểm tra user có online không
func (h *Handler) HandleCheckUserStatus(c *gin.Context) {
	userID := c.Param("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "User ID is required",
		})
		return
	}

	isOnline := h.Hub.IsUserOnline(userID)
	c.JSON(http.StatusOK, gin.H{
		"user_id":   userID,
		"is_online": isOnline,
	})
}

// HandleGetStats lấy thống kê về Hub
func (h *Handler) HandleGetStats(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"online_users":  h.Hub.GetClientCount(),
		"active_rooms":  h.Hub.GetRoomCount(),
	})
}

// HandleSendToUser gửi message đến một user cụ thể (REST API)
func (h *Handler) HandleSendToUser(c *gin.Context) {
	var req struct {
		UserID  string `json:"userId" binding:"required"`
		Message string `json:"message" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Tạo message
	msg := Message{
		Type:    MessageTypeSystem,
		Content: req.Message,
		SenderID: "system",
		SenderName: "System",
	}

	data, _ := json.Marshal(msg)
	
	// Gửi message
	sent := h.Hub.SendToUser(req.UserID, data)
	
	if sent {
		c.JSON(http.StatusOK, gin.H{
			"message": "Message sent successfully",
		})
	} else {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found or offline",
		})
	}
}

// HandleBroadcast broadcast message đến tất cả users (REST API)
func (h *Handler) HandleBroadcast(c *gin.Context) {
	var req struct {
		Message string `json:"message" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Tạo message
	msg := Message{
		Type:    MessageTypeSystem,
		Content: req.Message,
		SenderID: "system",
		SenderName: "System",
	}

	data, _ := json.Marshal(msg)
	
	// Broadcast
	h.Hub.Broadcast <- data
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Message broadcasted successfully",
	})
}