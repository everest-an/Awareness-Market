package middleware

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/awareness/w-matrix-marketplace/internal/database"
	"github.com/gin-gonic/gin"
)

// APIKeyAuth middleware validates API keys
func APIKeyAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Missing Authorization header",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid Authorization header format. Use: Bearer <api_key>",
			})
			c.Abort()
			return
		}

		apiKey := parts[1]

		var userID int
		var isActive bool
		var expiresAt sql.NullTime

		query := `
			SELECT user_id, is_active, expires_at
			FROM api_keys
			WHERE key_hash = SHA2(?, 256)
			LIMIT 1
		`

		err := database.DB.QueryRow(query, apiKey).Scan(&userID, &isActive, &expiresAt)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid API key",
			})
			c.Abort()
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Database error",
			})
			c.Abort()
			return
		}

		if !isActive {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "API key is inactive",
			})
			c.Abort()
			return
		}

		if expiresAt.Valid && expiresAt.Time.Before(time.Now()) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "API key has expired",
			})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Next()
	}
}
