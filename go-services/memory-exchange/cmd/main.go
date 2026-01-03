package main

import (
	"log"
	"os"

	"github.com/awareness/memory-exchange/internal/database"
	"github.com/awareness/memory-exchange/internal/handlers"
	"github.com/awareness/memory-exchange/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("Warning: .env file not found, using system environment variables")
	}

	// Initialize database
	if err := database.InitDB(); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer database.CloseDB()

	// Set Gin mode
	if os.Getenv("NODE_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin router
	router := gin.Default()

	// Apply middleware
	router.Use(middleware.CORS())

	// Health check endpoint (no auth required)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "memory-exchange",
			"version": "1.0.0",
		})
	})

	// API v1 routes (require authentication)
	v1 := router.Group("/api/v1")
	v1.Use(middleware.APIKeyAuth())
	{
		// Memory Exchange endpoints
		memory := v1.Group("/memory")
		{
			memory.POST("/publish", handlers.PublishMemory)
			memory.POST("/purchase", handlers.PurchaseMemory)
			memory.GET("/browse", handlers.BrowseMemories)
			memory.GET("/my-history", handlers.GetMyHistory)
		}

		// Reasoning Chain endpoints
		reasoning := v1.Group("/reasoning-chain")
		{
			reasoning.POST("/publish", handlers.PublishReasoningChain)
			reasoning.POST("/use", handlers.UseReasoningChain)
			reasoning.GET("/browse", handlers.BrowseReasoningChains)
		}

		// Stats endpoint
		v1.GET("/stats", handlers.GetStats)
	}

	// Start server
	port := os.Getenv("MEMORY_EXCHANGE_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Memory Exchange service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
