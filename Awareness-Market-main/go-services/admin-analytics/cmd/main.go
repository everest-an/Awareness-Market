package main

import (
	"log"

	"github.com/awareness-market/admin-analytics/internal/config"
	"github.com/awareness-market/admin-analytics/internal/handlers"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/awareness-market/admin-analytics/docs"
)

// @title Admin Analytics API
// @version 1.0
// @description Admin analytics and monitoring service for Awareness Market
// @host localhost:8082
// @BasePath /
func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}
	defer cfg.DB.Close()

	// Initialize Gin router
	router := gin.Default()

	// CORS middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Initialize handlers
	h := handlers.NewHandler(cfg.DB)

	// Routes
	v1 := router.Group("/api/v1")
	{
		// Analytics endpoints
		analytics := v1.Group("/analytics")
		{
			analytics.GET("/stats", h.GetAPIUsageStats)
			analytics.GET("/timeline", h.GetUsageTimeline)
			analytics.GET("/top-users", h.GetTopUsers)
		}

		// API Keys management
		v1.GET("/api-keys", h.GetAllAPIKeys)

		// Health endpoints
		health := v1.Group("/health")
		{
			health.GET("/services", h.GetServiceHealth)
		}
	}

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy", "service": "admin-analytics"})
	})

	log.Printf("🚀 Admin Analytics Service starting on port %s", cfg.Port)
	log.Printf("📚 Swagger UI available at http://localhost:%s/swagger/index.html", cfg.Port)

	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
