package ws

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"github.com/MITOM06/platform/apps/server/chat-service/internal/pubsub"
)

// Hub quản lý tất cả WebSocket connections và rooms
type Hub struct {
	// Map của clients đang active (key: userID)
	Clients map[string]*Client

	// Map của rooms (key: roomID, value: map of clients)
	Rooms map[string]map[*Client]bool

	// Channel để broadcast message đến tất cả clients
	Broadcast chan []byte

	// Channel để broadcast message đến một room cụ thể
	BroadcastToRoom chan *Message

	// Channel để đăng ký client mới
	Register chan *Client

	// Channel để hủy đăng ký client
	Unregister chan *Client

	// Mutex để đảm bảo thread-safe
	mu sync.RWMutex

	PubSub pubsub.PubSubService
}

// NewHub tạo Hub mới
func NewHub(ps pubsub.PubSubService) *Hub {
	return &Hub{
		Clients:         make(map[string]*Client),
		Rooms:           make(map[string]map[*Client]bool),
		Broadcast:       make(chan []byte, 256),
		BroadcastToRoom: make(chan *Message, 256),
		Register:        make(chan *Client),
		Unregister:      make(chan *Client),
		PubSub:          ps,
	}
}

// Run khởi động Hub để xử lý các operations
func (h *Hub) Run() {
	redisChan := h.PubSub.Subscribe(context.Background(), "chat_global")
	for {
		select {
		case client := <-h.Register:
			h.registerClient(client)

		case client := <-h.Unregister:
			h.unregisterClient(client)

		case message := <-h.Broadcast:
			h.broadcastToAll(message)

		case message := <-h.BroadcastToRoom:
			h.broadcastToRoom(message)

		case msgBytes := <-redisChan:
			h.broadcastLocal(msgBytes)
		}
	}
}

func (h *Hub) broadcastLocal(message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.Clients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)

		}
	}
}

func (h *Hub) PublishMessage(msg *Message) {
	h.PubSub.Publish(context.Background(), "chat_global", msg)
}

// registerClient đăng ký client mới
func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Nếu user đã có connection, đóng connection cũ
	if existingClient, exists := h.Clients[client.UserID]; exists {
		log.Printf("User %s already connected, closing old connection", client.UserID)
		existingClient.Close()
	}

	h.Clients[client.UserID] = client
	log.Printf("Client registered: %s (%s) - Total clients: %d",
		client.UserID, client.UserName, len(h.Clients))

	// Gửi welcome message
	welcomeMsg := map[string]interface{}{
		"type":    MessageTypeSystem,
		"content": "Connected to chat server",
		"userId":  client.UserID,
	}
	data, _ := json.Marshal(welcomeMsg)
	client.SendMessage(data)
}

// unregisterClient hủy đăng ký client
func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.Clients[client.UserID]; ok {
		// Xóa client khỏi tất cả rooms
		for roomID := range client.Rooms {
			h.removeClientFromRoom(roomID, client)
		}

		delete(h.Clients, client.UserID)
		close(client.Send)

		log.Printf("Client unregistered: %s (%s) - Total clients: %d",
			client.UserID, client.UserName, len(h.Clients))
	}
}

// broadcastToAll gửi message đến tất cả clients
func (h *Hub) broadcastToAll(message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.Clients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
		}
	}
}

// broadcastToRoom gửi message đến tất cả clients trong room
func (h *Hub) broadcastToRoom(message *Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if room, ok := h.Rooms[message.RoomID]; ok {
		data, err := json.Marshal(message)
		if err != nil {
			log.Printf("Error marshaling message: %v", err)
			return
		}

		for client := range room {
			select {
			case client.Send <- data:
			default:
				close(client.Send)
				delete(h.Clients, client.UserID)
			}
		}

		log.Printf("Broadcasted message to room %s: %d clients", message.RoomID, len(room))
	}
}

// BroadcastToRoomExcept gửi message đến tất cả clients trong room trừ một user cụ thể
func (h *Hub) BroadcastToRoomExcept(roomID string, message []byte, exceptUserID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if room, ok := h.Rooms[roomID]; ok {
		for client := range room {
			if client.UserID != exceptUserID {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.Clients, client.UserID)
				}
			}
		}
	}
}

// JoinRoom thêm client vào room
func (h *Hub) JoinRoom(roomID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.Rooms[roomID] == nil {
		h.Rooms[roomID] = make(map[*Client]bool)
		log.Printf("Created new room: %s", roomID)
	}

	h.Rooms[roomID][client] = true
	log.Printf("Client %s joined room %s - Room size: %d",
		client.UserID, roomID, len(h.Rooms[roomID]))
}

// LeaveRoom xóa client khỏi room
func (h *Hub) LeaveRoom(roomID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.removeClientFromRoom(roomID, client)
}

// removeClientFromRoom xóa client khỏi room (không lock - dùng internal)
func (h *Hub) removeClientFromRoom(roomID string, client *Client) {
	if room, ok := h.Rooms[roomID]; ok {
		delete(room, client)

		// Nếu room rỗng, xóa room
		if len(room) == 0 {
			delete(h.Rooms, roomID)
			log.Printf("Room %s is empty and removed", roomID)
		} else {
			log.Printf("Client %s left room %s - Room size: %d",
				client.UserID, roomID, len(room))
		}
	}
}

// GetClient lấy client theo userID
func (h *Hub) GetClient(userID string) (*Client, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	client, ok := h.Clients[userID]
	return client, ok
}

// GetRoomClients lấy danh sách clients trong room
func (h *Hub) GetRoomClients(roomID string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var clients []*Client
	if room, ok := h.Rooms[roomID]; ok {
		for client := range room {
			clients = append(clients, client)
		}
	}
	return clients
}

// GetClientCount trả về số lượng clients đang online
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return len(h.Clients)
}

// GetRoomCount trả về số lượng rooms đang active
func (h *Hub) GetRoomCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return len(h.Rooms)
}

// IsUserOnline kiểm tra user có online không
func (h *Hub) IsUserOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	_, ok := h.Clients[userID]
	return ok
}

// GetOnlineUsers lấy danh sách user IDs đang online
func (h *Hub) GetOnlineUsers() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users := make([]string, 0, len(h.Clients))
	for userID := range h.Clients {
		users = append(users, userID)
	}
	return users
}

// SendToUser gửi message đến một user cụ thể
func (h *Hub) SendToUser(userID string, message []byte) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if client, ok := h.Clients[userID]; ok {
		select {
		case client.Send <- message:
			return true
		default:
			return false
		}
	}
	return false
}
