package middleware

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/awareness/memory-exchange/internal/database"
	"github.com/gin-gonic/gin"
)

// APIKeyAuth middleware validates API keys
func APIKeyAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract API key from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Missing Authorization header",
			})
			c.Abort()
			return
		}

		// Check if it's a Bearer token
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

		// Validate API key against database
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
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Database error",
			})
			c.Abort()
			return
		}

		// Check if key is active
		if !isActive {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "API key has been revoked",
			})
			c.Abort()
			return
		}

		// Check if key has expired
		if expiresAt.Valid && expiresAt.Time.Before(time.Now()) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "API key has expired",
			})
			c.Abort()
			return
		}

		// Update last used timestamp
		go func() {
			updateQuery := `
				UPDATE api_keys
				SET last_used_at = NOW()
				WHERE key_hash = SHA2(?, 256)
			`
			database.DB.Exec(updateQuery, apiKey)
		}()

		// Set user ID in context
		c.Set("user_id", userID)
		c.Next()
	}
}

// CORS middleware
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
