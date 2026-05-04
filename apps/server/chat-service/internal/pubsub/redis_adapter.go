package pubsub

import (
	"context"
	"encoding/json"
	"log"

	"github.com/redis/go-redis/v9"
)

// PubSubService định nghĩa các interface cho việc Pub/Sub
type PubSubService interface {
	Publish(ctx context.Context, channel string, message interface{}) error
	Subscribe(ctx context.Context, channel string) <-chan []byte
	Close() error
}

type RedisPubSub struct {
	client *redis.Client
}

// NewRedisPubSub khởi tạo connection tới Redis
func NewRedisPubSub(addr string, password string, db int) *RedisPubSub {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password, // "" nếu không có pass
		DB:       db,       // 0 mặc định
	})

	// Ping thử để kiểm tra kết nối
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("Cannot connect to Redis: %v", err)
	}

	return &RedisPubSub{client: rdb}
}

// Publish gửi tin nhắn lên kênh Redis
func (r *RedisPubSub) Publish(ctx context.Context, channel string, message interface{}) error {
	// Marshal message sang JSON trước khi gửi
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}
	return r.client.Publish(ctx, channel, data).Err()
}

// Subscribe lắng nghe tin nhắn từ kênh Redis
// Trả về một Go Channel để bên ngoài có thể đọc dữ liệu
func (r *RedisPubSub) Subscribe(ctx context.Context, channel string) <-chan []byte {
	// Tạo channel Go để trả dữ liệu về cho Hub
	msgChan := make(chan []byte)

	pubsub := r.client.Subscribe(ctx, channel)

	// Chạy goroutine để lắng nghe liên tục
	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			msgChan <- []byte(msg.Payload)
		}
		close(msgChan)
	}()

	return msgChan
}

func (r *RedisPubSub) Close() error {
	return r.client.Close()
}