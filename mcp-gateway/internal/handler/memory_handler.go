package handler

import (
	"net/http"
	"time"

	"github.com/awareness-market/mcp-gateway/internal/model"
	"github.com/awareness-market/mcp-gateway/internal/service"
	"github.com/gin-gonic/gin"
)

// MemoryHandler handles HTTP requests for memory operations
type MemoryHandler struct {
	memoryService         *service.MemoryDiscoveryService
	recommendationService *service.RecommendationService
}

// NewMemoryHandler creates a new memory handler
func NewMemoryHandler(
	memoryService *service.MemoryDiscoveryService,
	recommendationService *service.RecommendationService,
) *MemoryHandler {
	return &MemoryHandler{
		memoryService:         memoryService,
		recommendationService: recommendationService,
	}
}

// DiscoverMemories handles memory discovery requests
func (h *MemoryHandler) DiscoverMemories(c *gin.Context) {
	var req model.DiscoveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default limit
	if req.Limit == 0 {
		req.Limit = 20
	}

	resp, err := h.memoryService.DiscoverMemories(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// RecommendMemories handles memory recommendation requests
func (h *MemoryHandler) RecommendMemories(c *gin.Context) {
	var req model.RecommendationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default limit
	if req.Limit == 0 {
		req.Limit = 10
	}

	resp, err := h.recommendationService.RecommendMemories(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// BatchDiscoverMemories handles batch memory discovery requests
func (h *MemoryHandler) BatchDiscoverMemories(c *gin.Context) {
	var req model.BatchDiscoveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startTime := time.Now()

	responses, err := h.memoryService.BatchDiscoverMemories(c.Request.Context(), req.Requests)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, model.BatchDiscoveryResponse{
		Responses:   responses,
		TotalTimeMs: time.Since(startTime).Milliseconds(),
	})
}
