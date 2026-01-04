package main

import (
	"log"
	"os"

	"github.com/awareness/w-matrix-marketplace/internal/database"
	"github.com/awareness/w-matrix-marketplace/internal/handlers"
	"github.com/awareness/w-matrix-marketplace/internal/middleware"
	"github.com/awareness/w-matrix-marketplace/internal/storage"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize database
	if err := database.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database:%v", err)
	}
	defer database.CloseDB()

	// Initialize S3 storage
	if err := storage.InitS3(); err != nil {
		log.Printf("⚠️  S3 not configured: %v", err)
	}

	// Create Gin router
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"service": "w-matrix-marketplace",
			"status":  "ok",
			"version": "1.0.0",
		})
	})

	// API routes with authentication
	api := router.Group("/api/v1")
	api.Use(middleware.APIKeyAuth())
	{
		api.POST("/listings", handlers.CreateListing)
		api.GET("/listings", handlers.BrowseListings)
		api.POST("/purchase", handlers.PurchaseListing)
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("🚀 W-Matrix Marketplace service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
