package main

import (
	"chat-service/internal/config"
	"chat-service/internal/middleware"
	"chat-service/internal/ws"
	"log"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()
	log.Printf("Starting Chat Service on %s:%s", cfg.ServerHost, cfg.ServerPort)
	log.Printf("Environment: %s", cfg.Environment)

	// Set Gin mode
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin router
	router := gin.Default()

	// Setup CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Create WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// Create WebSocket Handler
	wsHandler := ws.NewHandler(hub)

	// Setup routes
	setupRoutes(router, wsHandler, cfg)

	// Start server
	server := &http.Server{
		Addr:           cfg.ServerHost + ":" + cfg.ServerPort,
		Handler:        router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1 MB
	}

	log.Printf("Server is running on http://%s:%s", cfg.ServerHost, cfg.ServerPort)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func setupRoutes(router *gin.Engine, wsHandler *ws.Handler, cfg *config.Config) {
	// Health check endpoint (no auth required)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "chat-service",
			"time":    time.Now().Unix(),
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// WebSocket endpoint (requires auth)
		v1.GET("/ws", middleware.AuthMiddleware(cfg.JWTSecret), wsHandler.HandleWebSocket)

		// Chat info endpoints (requires auth)
		chat := v1.Group("/chat")
		chat.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// Get online users
			chat.GET("/online-users", wsHandler.HandleGetOnlineUsers)
			
			// Get room users
			chat.GET("/rooms/:roomId/users", wsHandler.HandleGetRoomUsers)
			
			// Check user status
			chat.GET("/users/:userId/status", wsHandler.HandleCheckUserStatus)
			
			// Get stats
			chat.GET("/stats", wsHandler.HandleGetStats)
			
			// Send message to specific user (REST API)
			chat.POST("/send", wsHandler.HandleSendToUser)
			
			// Broadcast message (REST API)
			chat.POST("/broadcast", wsHandler.HandleBroadcast)
		}
	}

	// Log registered routes
	log.Println("Registered routes:")
	for _, route := range router.Routes() {
		log.Printf("  %s %s", route.Method, route.Path)
	}
}