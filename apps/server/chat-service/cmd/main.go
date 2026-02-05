package main

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "Chat Service (Go)",
			"status":  "Active",
		})
	})

	// Chạy ở port 3002 (để không đụng Auth Service 3001)
	r.Run(":3002")
}