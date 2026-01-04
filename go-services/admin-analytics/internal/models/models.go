package models

import "time"

// APIUsageStats represents aggregated API usage statistics
type APIUsageStats struct {
	TotalRequests   int64   `json:"total_requests"`
	TotalUsers      int64   `json:"total_users"`
	AvgResponseTime float64 `json:"avg_response_time"`
	ErrorRate       float64 `json:"error_rate"`
	RequestsToday   int64   `json:"requests_today"`
}

// UsageTimelinePoint represents a single point in the usage timeline
type UsageTimelinePoint struct {
	Date     string `json:"date"`
	Requests int64  `json:"requests"`
	Errors   int64  `json:"errors"`
}

// TopUser represents a user with high API usage
type TopUser struct {
	UserID       int64  `json:"user_id"`
	UserName     string `json:"user_name"`
	Email        string `json:"email"`
	RequestCount int64  `json:"request_count"`
	LastActive   string `json:"last_active"`
}

// APIKeyInfo represents detailed API key information
type APIKeyInfo struct {
	ID           int64     `json:"id"`
	UserID       int64     `json:"user_id"`
	UserName     string    `json:"user_name"`
	Name         string    `json:"name"`
	KeyPrefix    string    `json:"key_prefix"`
	LastUsedAt   *time.Time `json:"last_used_at"`
	CreatedAt    time.Time `json:"created_at"`
	ExpiresAt    *time.Time `json:"expires_at"`
	IsActive     bool      `json:"is_active"`
	RequestCount int64     `json:"request_count"`
}

// RateLimitConfig represents rate limit configuration for an API key
type RateLimitConfig struct {
	ID            int64     `json:"id"`
	APIKeyID      int64     `json:"api_key_id"`
	RequestsPerHour int     `json:"requests_per_hour"`
	RequestsPerDay  int     `json:"requests_per_day"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ServiceHealth represents the health status of a microservice
type ServiceHealth struct {
	ServiceName string `json:"service_name"`
	Port        int    `json:"port"`
	Status      string `json:"status"` // "running", "stopped", "error"
	Uptime      string `json:"uptime"`
	LastCheck   string `json:"last_check"`
}
