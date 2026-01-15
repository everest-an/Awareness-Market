package main

import (
	"log"
	"vector-operations/internal/config"
	"vector-operations/internal/handlers"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "vector-operations/docs"
)

// @title Vector Operations API
// @version 1.0
// @description High-performance vector storage and similarity search service
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.awareness.market/support
// @contact.email support@awareness.market

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8083
// @BasePath /
// @schemes http https

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name X-API-Key

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize router
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Initialize handlers
	h := handlers.NewHandler(cfg.DB)

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"service": "vector-operations",
			"status":  "healthy",
		})
	})

	// API routes
	api := r.Group("/api/v1")
	{
		vectors := api.Group("/vectors")
		{
			vectors.GET("/stats", h.GetVectorStats)
			vectors.POST("/search", h.SearchVectors)
			vectors.POST("", h.StoreVector)
			vectors.POST("/batch", h.BatchStoreVectors)
		}
	}

	// Swagger documentation
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	log.Printf("🚀 Vector Operations Service starting on port %s", cfg.Port)
	log.Printf("📚 Swagger UI: http://localhost:%s/swagger/index.html", cfg.Port)

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
