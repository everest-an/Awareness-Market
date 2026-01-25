package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/awareness-market/mcp-gateway/internal/handler"
	"github.com/awareness-market/mcp-gateway/internal/service"
	"github.com/awareness-market/mcp-gateway/pkg/client"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize services
	apiClient := client.NewAwarenessAPIClient(getEnv("API_BASE_URL", "http://localhost:3000"))
	memoryService := service.NewMemoryDiscoveryService(apiClient)
	recommendationService := service.NewRecommendationService(apiClient)

	// Initialize handlers
	memoryHandler := handler.NewMemoryHandler(memoryService, recommendationService)

	// Setup router
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

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "mcp-gateway"})
	})

	// Memory discovery endpoints
	v1 := router.Group("/api/v1")
	{
		v1.POST("/discover", memoryHandler.DiscoverMemories)
		v1.POST("/recommend", memoryHandler.RecommendMemories)
		v1.POST("/batch-discover", memoryHandler.BatchDiscoverMemories)
	}

	// Start server
	port := getEnv("PORT", "8080")
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Printf("MCP Gateway starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
