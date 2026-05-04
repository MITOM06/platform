package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config chứa tất cả cấu hình của ứng dụng
type Config struct {
	// Server
	ServerPort string
	ServerHost string
	
	// JWT
	JWTSecret string
	
	// Redis
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int
	
	// MongoDB
	MongoURI      string
	MongoDB       string
	
	// WebSocket
	WSMaxMessageSize int64
	WSReadBufferSize int
	WSWriteBufferSize int
	
	// CORS
	AllowedOrigins []string
	
	// Environment
	Environment string
}

// Load tải cấu hình từ environment variables
func Load() *Config {
	// Load .env file nếu có
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	config := &Config{
		// Server
		ServerPort: getEnv("SERVER_PORT", "8081"),
		ServerHost: getEnv("SERVER_HOST", "0.0.0.0"),
		
		// JWT
		JWTSecret: getEnv("JWT_SECRET", "your-secret-key-change-this-in-production"),
		
		// Redis
		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),
		
		// MongoDB
		MongoURI: getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:  getEnv("MONGO_DB", "chat_db"),
		
		// WebSocket
		WSMaxMessageSize:  getEnvAsInt64("WS_MAX_MESSAGE_SIZE", 512*1024), // 512 KB
		WSReadBufferSize:  getEnvAsInt("WS_READ_BUFFER_SIZE", 1024),
		WSWriteBufferSize: getEnvAsInt("WS_WRITE_BUFFER_SIZE", 1024),
		
		// Environment
		Environment: getEnv("ENVIRONMENT", "development"),
	}

	// Parse allowed origins
	originsStr := getEnv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8081")
	config.AllowedOrigins = parseAllowedOrigins(originsStr)

	return config
}

// getEnv lấy environment variable hoặc trả về giá trị mặc định
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt lấy environment variable dạng int
func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if valueStr == "" {
		return defaultValue
	}
	
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		log.Printf("Error parsing %s as int: %v, using default value", key, err)
		return defaultValue
	}
	
	return value
}

// getEnvAsInt64 lấy environment variable dạng int64
func getEnvAsInt64(key string, defaultValue int64) int64 {
	valueStr := getEnv(key, "")
	if valueStr == "" {
		return defaultValue
	}
	
	value, err := strconv.ParseInt(valueStr, 10, 64)
	if err != nil {
		log.Printf("Error parsing %s as int64: %v, using default value", key, err)
		return defaultValue
	}
	
	return value
}

// parseAllowedOrigins parse chuỗi origins thành slice
func parseAllowedOrigins(origins string) []string {
	if origins == "" {
		return []string{"*"}
	}
	
	// Split by comma
	var result []string
	for _, origin := range splitByComma(origins) {
		if origin != "" {
			result = append(result, origin)
		}
	}
	
	return result
}

// splitByComma tách chuỗi bởi dấu phẩy
func splitByComma(s string) []string {
	var result []string
	current := ""
	
	for _, char := range s {
		if char == ',' {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	
	if current != "" {
		result = append(result, current)
	}
	
	return result
}

// GetRedisAddress trả về Redis address
func (c *Config) GetRedisAddress() string {
	return c.RedisHost + ":" + c.RedisPort
}

// IsDevelopment kiểm tra môi trường development
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsProduction kiểm tra môi trường production
func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}