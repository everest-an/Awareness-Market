package middleware

import (
	"database/sql"
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

type MetricsMiddleware struct {
	DB          *sql.DB
	ServiceName string
}

func NewMetricsMiddleware(db *sql.DB, serviceName string) *MetricsMiddleware {
	return &MetricsMiddleware{
		DB:          db,
		ServiceName: serviceName,
	}
}

// LogAPICall logs API requests to the database for analytics
func (m *MetricsMiddleware) LogAPICall() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		// Process request
		c.Next()

		// Calculate response time
		responseTime := time.Since(startTime).Milliseconds()

		// Get request details
		method := c.Request.Method
		endpoint := c.Request.URL.Path
		statusCode := c.Writer.Status()
		apiKey := c.GetHeader("X-API-Key")
		userAgent := c.GetHeader("User-Agent")

		// Determine if error
		isError := statusCode >= 400

		// Log to database if available
		if m.DB != nil {
			go m.logToDatabase(method, endpoint, statusCode, responseTime, apiKey, userAgent, isError)
		} else {
			// Log to console if DB not available
			log.Printf("[%s] %s %s - %d (%dms)", m.ServiceName, method, endpoint, statusCode, responseTime)
		}
	}
}

func (m *MetricsMiddleware) logToDatabase(method, endpoint string, statusCode int, responseTime int64, apiKey, userAgent string, isError bool) {
	_, err := m.DB.Exec(`
		INSERT INTO api_usage_logs 
		(service_name, endpoint, method, status_code, response_time_ms, api_key, user_agent, is_error, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, m.ServiceName, endpoint, method, statusCode, responseTime, apiKey, userAgent, isError, time.Now())

	if err != nil {
		log.Printf("Failed to log API call: %v", err)
	}
}
