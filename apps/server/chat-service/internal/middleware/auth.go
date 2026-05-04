package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTClaims định nghĩa claims trong JWT token
type JWTClaims struct {
	UserID   string `json:"userId"`
	UserName string `json:"userName"`
	Email    string `json:"email"`
	jwt.RegisteredClaims
}

// AuthMiddleware xác thực JWT token
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Lấy token từ header hoặc query parameter
		tokenString := extractToken(c)
		
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "No authorization token provided",
			})
			c.Abort()
			return
		}

		// Parse và validate token
		claims := &JWTClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			// Kiểm tra signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Set user info vào context
		c.Set("userID", claims.UserID)
		c.Set("userName", claims.UserName)
		c.Set("email", claims.Email)

		c.Next()
	}
}

// extractToken lấy token từ header hoặc query parameter
func extractToken(c *gin.Context) string {
	// Thử lấy từ Authorization header
	bearerToken := c.GetHeader("Authorization")
	if bearerToken != "" {
		// Format: "Bearer <token>"
		parts := strings.Split(bearerToken, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			return parts[1]
		}
		// Nếu không có "Bearer", trả về toàn bộ string
		return bearerToken
	}

	// Thử lấy từ query parameter (cho WebSocket)
	token := c.Query("token")
	if token != "" {
		return token
	}

	// Thử lấy từ cookie
	token, _ = c.Cookie("token")
	return token
}

// OptionalAuthMiddleware xác thực token nhưng không bắt buộc
// Nếu có token hợp lệ thì set user info, không có thì vẫn tiếp tục
func OptionalAuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := extractToken(c)
		
		if tokenString != "" {
			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(jwtSecret), nil
			})

			if err == nil && token.Valid {
				c.Set("userID", claims.UserID)
				c.Set("userName", claims.UserName)
				c.Set("email", claims.Email)
			}
		}

		c.Next()
	}
}