package main

import (
	"log"
	"recommendation-engine/internal/config"
	"recommendation-engine/internal/handlers"

	_ "recommendation-engine/docs"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title Recommendation Engine API
// @version 1.0
// @description AI-powered recommendation engine for Awareness Marketplace
// @host localhost:8085
// @BasePath /
// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name X-API-Key

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load config:", err)
	}

	handler := handlers.NewHandler()

	router := gin.Default()

	// CORS middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Health check
	router.GET("/health", handler.HealthCheck)

	// API routes
	api := router.Group("/api/v1")
	{
		recommendations := api.Group("/recommendations")
		{
			recommendations.GET("", handler.GetRecommendations)
			recommendations.GET("/similar", handler.GetSimilarItems)
			recommendations.POST("/track", handler.TrackInteraction)
		}
	}

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	log.Printf("Recommendation Engine starting on port %s", cfg.Port)
	log.Printf("Swagger UI available at http://localhost:%s/swagger/index.html", cfg.Port)

	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
