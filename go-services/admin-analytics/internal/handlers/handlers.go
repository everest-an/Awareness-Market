package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/awareness-market/admin-analytics/internal/models"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	DB *sql.DB
}

func NewHandler(db *sql.DB) *Handler {
	return &Handler{DB: db}
}

// GetAPIUsageStats godoc
// @Summary Get API usage statistics
// @Description Get aggregated API usage statistics for admin dashboard
// @Tags Analytics
// @Produce json
// @Success 200 {object} models.APIUsageStats
// @Failure 500 {object} map[string]string
// @Router /api/v1/analytics/stats [get]
func (h *Handler) GetAPIUsageStats(c *gin.Context) {
	var stats models.APIUsageStats

	// Return mock data if DB is not available
	if h.DB == nil {
		stats = models.APIUsageStats{
			TotalRequests:   15234,
			TotalUsers:      127,
			AvgResponseTime: 145.6,
			ErrorRate:       2.3,
			RequestsToday:   892,
		}
		c.JSON(http.StatusOK, stats)
		return
	}

	// Total requests
	err := h.DB.QueryRow(`
		SELECT COUNT(*) FROM api_usage_logs
	`).Scan(&stats.TotalRequests)
	if err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Total users
	err = h.DB.QueryRow(`
		SELECT COUNT(DISTINCT user_id) FROM api_usage_logs WHERE user_id IS NOT NULL
	`).Scan(&stats.TotalUsers)
	if err != nil && err != sql.ErrNoRows {
		stats.TotalUsers = 0
	}

	// Average response time
	err = h.DB.QueryRow(`
		SELECT AVG(response_time_ms) FROM api_usage_logs WHERE response_time_ms IS NOT NULL
	`).Scan(&stats.AvgResponseTime)
	if err != nil && err != sql.ErrNoRows {
		stats.AvgResponseTime = 0
	}

	// Error rate
	var totalReqs, errorReqs int64
	h.DB.QueryRow(`SELECT COUNT(*) FROM api_usage_logs`).Scan(&totalReqs)
	h.DB.QueryRow(`SELECT COUNT(*) FROM api_usage_logs WHERE status_code >= 400`).Scan(&errorReqs)
	if totalReqs > 0 {
		stats.ErrorRate = float64(errorReqs) / float64(totalReqs) * 100
	}

	// Requests today
	err = h.DB.QueryRow(`
		SELECT COUNT(*) FROM api_usage_logs 
		WHERE DATE(timestamp) = CURDATE()
	`).Scan(&stats.RequestsToday)
	if err != nil && err != sql.ErrNoRows {
		stats.RequestsToday = 0
	}

	c.JSON(http.StatusOK, stats)
}

// GetUsageTimeline godoc
// @Summary Get usage timeline
// @Description Get daily API usage timeline for the past 30 days
// @Tags Analytics
// @Produce json
// @Param days query int false "Number of days" default(30)
// @Success 200 {array} models.UsageTimelinePoint
// @Failure 500 {object} map[string]string
// @Router /api/v1/analytics/timeline [get]
func (h *Handler) GetUsageTimeline(c *gin.Context) {
	days := c.DefaultQuery("days", "30")

	rows, err := h.DB.Query(`
		SELECT 
			DATE(timestamp) as date,
			COUNT(*) as requests,
			SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
		FROM api_usage_logs
		WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
		GROUP BY DATE(timestamp)
		ORDER BY date ASC
	`, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var timeline []models.UsageTimelinePoint
	for rows.Next() {
		var point models.UsageTimelinePoint
		var date time.Time
		if err := rows.Scan(&date, &point.Requests, &point.Errors); err != nil {
			continue
		}
		point.Date = date.Format("2006-01-02")
		timeline = append(timeline, point)
	}

	c.JSON(http.StatusOK, timeline)
}

// GetTopUsers godoc
// @Summary Get top users by API usage
// @Description Get list of users with highest API usage
// @Tags Analytics
// @Produce json
// @Param limit query int false "Number of users to return" default(10)
// @Success 200 {array} models.TopUser
// @Failure 500 {object} map[string]string
// @Router /api/v1/analytics/top-users [get]
func (h *Handler) GetTopUsers(c *gin.Context) {
	limit := c.DefaultQuery("limit", "10")

	rows, err := h.DB.Query(`
		SELECT 
			u.id,
			u.name,
			u.email,
			COUNT(l.id) as request_count,
			MAX(l.timestamp) as last_active
		FROM users u
		INNER JOIN api_usage_logs l ON u.id = l.user_id
		GROUP BY u.id, u.name, u.email
		ORDER BY request_count DESC
		LIMIT ?
	`, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var users []models.TopUser
	for rows.Next() {
		var user models.TopUser
		var lastActive time.Time
		if err := rows.Scan(&user.UserID, &user.UserName, &user.Email, &user.RequestCount, &lastActive); err != nil {
			continue
		}
		user.LastActive = lastActive.Format("2006-01-02 15:04:05")
		users = append(users, user)
	}

	c.JSON(http.StatusOK, users)
}

// GetAllAPIKeys godoc
// @Summary Get all API keys
// @Description Get list of all API keys with usage information (admin only)
// @Tags API Keys
// @Produce json
// @Success 200 {array} models.APIKeyInfo
// @Failure 500 {object} map[string]string
// @Router /api/v1/api-keys [get]
func (h *Handler) GetAllAPIKeys(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT 
			k.id,
			k.user_id,
			u.name as user_name,
			k.name,
			k.key_prefix,
			k.last_used_at,
			k.created_at,
			k.expires_at,
			k.is_active,
			COALESCE(COUNT(l.id), 0) as request_count
		FROM api_keys k
		INNER JOIN users u ON k.user_id = u.id
		LEFT JOIN api_usage_logs l ON k.id = l.api_key_id
		GROUP BY k.id, k.user_id, u.name, k.name, k.key_prefix, k.last_used_at, k.created_at, k.expires_at, k.is_active
		ORDER BY k.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var keys []models.APIKeyInfo
	for rows.Next() {
		var key models.APIKeyInfo
		if err := rows.Scan(
			&key.ID, &key.UserID, &key.UserName, &key.Name, &key.KeyPrefix,
			&key.LastUsedAt, &key.CreatedAt, &key.ExpiresAt, &key.IsActive, &key.RequestCount,
		); err != nil {
			continue
		}
		keys = append(keys, key)
	}

	c.JSON(http.StatusOK, keys)
}

// GetServiceHealth godoc
// @Summary Get microservices health status
// @Description Get health status of all microservices
// @Tags Health
// @Produce json
// @Success 200 {array} models.ServiceHealth
// @Router /api/v1/health/services [get]
func (h *Handler) GetServiceHealth(c *gin.Context) {
	services := []models.ServiceHealth{
		{ServiceName: "Memory Exchange", Port: 8080, Status: "running", Uptime: "N/A", LastCheck: time.Now().Format(time.RFC3339)},
		{ServiceName: "W-Matrix Marketplace", Port: 8081, Status: "running", Uptime: "N/A", LastCheck: time.Now().Format(time.RFC3339)},
		{ServiceName: "Admin Analytics", Port: 8082, Status: "running", Uptime: "N/A", LastCheck: time.Now().Format(time.RFC3339)},
	}

	// TODO: Implement actual health checks by pinging each service
	c.JSON(http.StatusOK, services)
}
