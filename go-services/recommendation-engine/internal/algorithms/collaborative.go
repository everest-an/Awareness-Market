package algorithms

import (
	"math"
	"recommendation-engine/internal/models"
	"sort"
	"time"
)

// CollaborativeFilter implements collaborative filtering recommendation
type CollaborativeFilter struct{}

// GenerateRecommendations generates personalized recommendations based on user behavior
func (cf *CollaborativeFilter) GenerateRecommendations(userID string, limit int) []models.Recommendation {
	// Mock implementation - in production, this would use actual user interaction data
	mockRecommendations := []models.Recommendation{
		{
			ItemID:      "rc_001",
			ItemType:    "reasoning_chain",
			Score:       0.95,
			Reason:      "Based on your recent views",
			Title:       "Advanced Multi-Agent Coordination",
			Description: "A reasoning chain for complex task decomposition",
		},
		{
			ItemID:      "wm_002",
			ItemType:    "w_matrix",
			Score:       0.89,
			Reason:      "Popular among similar users",
			Title:       "Semantic Search Optimization",
			Description: "W-Matrix for enhanced vector search",
		},
		{
			ItemID:      "rc_003",
			ItemType:    "reasoning_chain",
			Score:       0.85,
			Reason:      "Trending in your category",
			Title:       "Autonomous Decision Making",
			Description: "Self-improving reasoning patterns",
		},
		{
			ItemID:      "wm_004",
			ItemType:    "w_matrix",
			Score:       0.82,
			Reason:      "Frequently purchased together",
			Title:       "Context-Aware Embeddings",
			Description: "Dynamic vector representations",
		},
		{
			ItemID:      "rc_005",
			ItemType:    "reasoning_chain",
			Score:       0.78,
			Reason:      "New release matching your interests",
			Title:       "Hierarchical Planning System",
			Description: "Multi-level goal decomposition",
		},
	}

	// Sort by score descending
	sort.Slice(mockRecommendations, func(i, j int) bool {
		return mockRecommendations[i].Score > mockRecommendations[j].Score
	})

	// Apply limit
	if limit > 0 && limit < len(mockRecommendations) {
		mockRecommendations = mockRecommendations[:limit]
	}

	return mockRecommendations
}

// FindSimilarItems finds items similar to the given item
func (cf *CollaborativeFilter) FindSimilarItems(itemID string, limit int) []models.Recommendation {
	// Mock implementation
	mockSimilar := []models.Recommendation{
		{
			ItemID:      "rc_101",
			ItemType:    "reasoning_chain",
			Score:       0.92,
			Reason:      "Similar reasoning patterns",
			Title:       "Related Reasoning Chain A",
			Description: "Uses similar cognitive strategies",
		},
		{
			ItemID:      "rc_102",
			ItemType:    "reasoning_chain",
			Score:       0.87,
			Reason:      "Same problem domain",
			Title:       "Related Reasoning Chain B",
			Description: "Addresses similar challenges",
		},
		{
			ItemID:      "wm_103",
			ItemType:    "w_matrix",
			Score:       0.83,
			Reason:      "Compatible architecture",
			Title:       "Compatible W-Matrix",
			Description: "Works well with this item",
		},
	}

	sort.Slice(mockSimilar, func(i, j int) bool {
		return mockSimilar[i].Score > mockSimilar[j].Score
	})

	if limit > 0 && limit < len(mockSimilar) {
		mockSimilar = mockSimilar[:limit]
	}

	return mockSimilar
}

// ContentBasedFilter implements content-based filtering
type ContentBasedFilter struct{}

// GenerateRecommendations generates recommendations based on item features
func (cbf *ContentBasedFilter) GenerateRecommendations(userID string, limit int) []models.Recommendation {
	// Mock implementation
	return []models.Recommendation{
		{
			ItemID:      "rc_201",
			ItemType:    "reasoning_chain",
			Score:       0.91,
			Reason:      "Matches your preferred topics",
			Title:       "Topic-Matched Reasoning",
			Description: "Aligned with your interests",
		},
		{
			ItemID:      "wm_202",
			ItemType:    "w_matrix",
			Score:       0.86,
			Reason:      "Similar feature vectors",
			Title:       "Feature-Matched W-Matrix",
			Description: "High semantic similarity",
		},
	}
}

// HybridRecommender combines multiple recommendation strategies
type HybridRecommender struct {
	Collaborative *CollaborativeFilter
	ContentBased  *ContentBasedFilter
}

// NewHybridRecommender creates a new hybrid recommender
func NewHybridRecommender() *HybridRecommender {
	return &HybridRecommender{
		Collaborative: &CollaborativeFilter{},
		ContentBased:  &ContentBasedFilter{},
	}
}

// GenerateRecommendations combines collaborative and content-based recommendations
func (hr *HybridRecommender) GenerateRecommendations(userID string, limit int) models.RecommendationResponse {
	// Get recommendations from both strategies
	collabRecs := hr.Collaborative.GenerateRecommendations(userID, limit*2)
	contentRecs := hr.ContentBased.GenerateRecommendations(userID, limit*2)

	// Combine and deduplicate
	combined := make(map[string]models.Recommendation)
	for _, rec := range collabRecs {
		combined[rec.ItemID] = rec
	}
	for _, rec := range contentRecs {
		if existing, exists := combined[rec.ItemID]; exists {
			// Average the scores if item appears in both
			rec.Score = (existing.Score + rec.Score) / 2
		}
		combined[rec.ItemID] = rec
	}

	// Convert map to slice
	finalRecs := make([]models.Recommendation, 0, len(combined))
	for _, rec := range combined {
		finalRecs = append(finalRecs, rec)
	}

	// Sort by score
	sort.Slice(finalRecs, func(i, j int) bool {
		return finalRecs[i].Score > finalRecs[j].Score
	})

	// Apply limit
	if limit > 0 && limit < len(finalRecs) {
		finalRecs = finalRecs[:limit]
	}

	return models.RecommendationResponse{
		Recommendations: finalRecs,
		GeneratedAt:     time.Now(),
	}
}

// CosineSimilarity calculates cosine similarity between two vectors
func CosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0
	}

	var dotProduct, normA, normB float64
	for i := range a {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}
