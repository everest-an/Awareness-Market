package handlers

import (
	"net/http"
	"recommendation-engine/internal/algorithms"
	"recommendation-engine/internal/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	Recommender *algorithms.HybridRecommender
}

func NewHandler() *Handler {
	return &Handler{
		Recommender: algorithms.NewHybridRecommender(),
	}
}

// GetRecommendations godoc
// @Summary Get personalized recommendations
// @Description Get personalized recommendations for a user
// @Tags recommendations
// @Accept json
// @Produce json
// @Param user_id query string true "User ID"
// @Param limit query int false "Number of recommendations" default(10)
// @Param type query string false "Filter by type (reasoning_chain or w_matrix)"
// @Success 200 {object} models.RecommendationResponse
// @Router /api/v1/recommendations [get]
// @Security ApiKeyAuth
func (h *Handler) GetRecommendations(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 10
	}

	itemType := c.Query("type")

	response := h.Recommender.GenerateRecommendations(userID, limit)

	// Filter by type if specified
	if itemType != "" {
		filtered := []models.Recommendation{}
		for _, rec := range response.Recommendations {
			if rec.ItemType == itemType {
				filtered = append(filtered, rec)
			}
		}
		response.Recommendations = filtered
	}

	c.JSON(http.StatusOK, response)
}

// GetSimilarItems godoc
// @Summary Get similar items
// @Description Find items similar to the given item
// @Tags recommendations
// @Accept json
// @Produce json
// @Param item_id query string true "Item ID"
// @Param limit query int false "Number of similar items" default(5)
// @Success 200 {object} models.RecommendationResponse
// @Router /api/v1/recommendations/similar [get]
// @Security ApiKeyAuth
func (h *Handler) GetSimilarItems(c *gin.Context) {
	itemID := c.Query("item_id")
	if itemID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_id is required"})
		return
	}

	limitStr := c.DefaultQuery("limit", "5")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 5
	}

	similar := h.Recommender.Collaborative.FindSimilarItems(itemID, limit)

	c.JSON(http.StatusOK, models.RecommendationResponse{
		Recommendations: similar,
	})
}

// TrackInteraction godoc
// @Summary Track user interaction
// @Description Record a user's interaction with an item for future recommendations
// @Tags recommendations
// @Accept json
// @Produce json
// @Param interaction body models.UserInteraction true "User interaction data"
// @Success 200 {object} map[string]string
// @Router /api/v1/recommendations/track [post]
// @Security ApiKeyAuth
func (h *Handler) TrackInteraction(c *gin.Context) {
	var interaction models.UserInteraction
	if err := c.ShouldBindJSON(&interaction); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In production, this would save to database
	// For now, just acknowledge receipt
	c.JSON(http.StatusOK, gin.H{
		"message": "Interaction tracked successfully",
		"user_id": interaction.UserID,
		"item_id": interaction.ItemID,
	})
}

// HealthCheck godoc
// @Summary Health check
// @Description Check if the service is running
// @Tags health
// @Produce json
// @Success 200 {object} map[string]string
// @Router /health [get]
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"service": "recommendation-engine",
		"status":  "healthy",
	})
}
