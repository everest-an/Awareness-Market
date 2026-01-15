package main

import (
	"log"
	"os"

	"github.com/awareness/w-matrix-marketplace/internal/database"
	"github.com/awareness/w-matrix-marketplace/internal/handlers"
	"github.com/awareness/w-matrix-marketplace/internal/middleware"
	"github.com/awareness/w-matrix-marketplace/internal/storage"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	_ "github.com/awareness/w-matrix-marketplace/docs" // Import generated docs
)

// @title W-Matrix Marketplace API
// @version 1.0
// @description RESTful API for trading W-Matrix alignment tools and cross-model transformation matrices
// @termsOfService https://awareness.market/terms

// @contact.name Awareness Market Support
// @contact.url https://awareness.market/support
// @contact.email support@awareness.market

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8081
// @BasePath /api/v1

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name Authorization
// @description Enter your API key in the format: Bearer {your_api_key}

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

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

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
	log.Printf("📖 Swagger documentation available at http://localhost:%s/swagger/index.html", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
