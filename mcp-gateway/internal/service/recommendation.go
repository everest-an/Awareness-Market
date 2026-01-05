package service

import (
	"context"
	"math"
	"sort"

	"github.com/awareness-market/mcp-gateway/internal/model"
	"github.com/awareness-market/mcp-gateway/pkg/client"
)

// RecommendationService provides intelligent memory recommendations
type RecommendationService struct {
	apiClient *client.AwarenessAPIClient
}

// NewRecommendationService creates a new recommendation service
func NewRecommendationService(apiClient *client.AwarenessAPIClient) *RecommendationService {
	return &RecommendationService{
		apiClient: apiClient,
	}
}

// RecommendMemories recommends memories based on context, quality, and agent credit scores
func (s *RecommendationService) RecommendMemories(ctx context.Context, req *model.RecommendationRequest) (*model.RecommendationResponse, error) {
	// Get available memories
	memories, err := s.fetchAvailableMemories(ctx, req)
	if err != nil {
		return nil, err
	}

	// Calculate recommendation scores
	scoredMemories := s.scoreMemories(memories, req)

	// Sort by recommendation score
	sort.Slice(scoredMemories, func(i, j int) bool {
		return scoredMemories[i].RecommendationScore > scoredMemories[j].RecommendationScore
	})

	// Apply limit
	if req.Limit > 0 && len(scoredMemories) > req.Limit {
		scoredMemories = scoredMemories[:req.Limit]
	}

	return &model.RecommendationResponse{
		Recommendations: scoredMemories,
		TotalFound:      len(scoredMemories),
	}, nil
}

// fetchAvailableMemories fetches available memories from the marketplace
func (s *RecommendationService) fetchAvailableMemories(ctx context.Context, req *model.RecommendationRequest) ([]model.Memory, error) {
	// TODO: Implement actual API call
	// For now, return mock data
	
	return []model.Memory{
		{
			ID:            "mem-001",
			Type:          "kv-cache",
			Name:          "GPT-4 Medical KV-Cache",
			Epsilon:       0.0234,
			Certification: "gold",
			Price:         499.0,
			AgentAddress:  "0x1111111111111111111111111111111111111111",
			AgentCreditScore: 842,
		},
		{
			ID:            "mem-002",
			Type:          "w-matrix",
			Name:          "Claude → GPT-4 Matrix",
			Epsilon:       0.0356,
			Certification: "gold",
			Price:         299.0,
			AgentAddress:  "0x2222222222222222222222222222222222222222",
			AgentCreditScore: 815,
		},
		{
			ID:            "mem-003",
			Type:          "reasoning-chain",
			Name:          "Math Reasoning Chain",
			Epsilon:       0.0512,
			Certification: "silver",
			Price:         199.0,
			AgentAddress:  "0x3333333333333333333333333333333333333333",
			AgentCreditScore: 792,
		},
	}, nil
}

// scoreMemories calculates recommendation scores for memories
func (s *RecommendationService) scoreMemories(memories []model.Memory, req *model.RecommendationRequest) []model.ScoredMemory {
	scored := make([]model.ScoredMemory, len(memories))
	
	for i, memory := range memories {
		score := s.calculateRecommendationScore(memory, req)
		scored[i] = model.ScoredMemory{
			Memory:             memory,
			RecommendationScore: score,
			Explanation:        s.generateExplanation(memory, score),
		}
	}
	
	return scored
}

// calculateRecommendationScore calculates a comprehensive recommendation score
func (s *RecommendationService) calculateRecommendationScore(memory model.Memory, req *model.RecommendationRequest) float64 {
	// Weights for different factors
	const (
		qualityWeight      = 0.35  // Epsilon (lower is better)
		creditWeight       = 0.25  // Agent credit score
		priceWeight        = 0.20  // Price (lower is better for budget-conscious)
		certificationWeight = 0.20  // Certification level
	)
	
	// Quality score (inverse of epsilon, normalized to 0-1)
	qualityScore := 1.0 - math.Min(memory.Epsilon/0.1, 1.0)
	
	// Credit score (normalized to 0-1, assuming max score is 850)
	creditScore := float64(memory.AgentCreditScore) / 850.0
	
	// Price score (inverse, normalized)
	priceScore := 1.0 - math.Min(memory.Price/1000.0, 1.0)
	if req.MaxBudget > 0 {
		if memory.Price > req.MaxBudget {
			priceScore = 0 // Out of budget
		}
	}
	
	// Certification score
	certScore := getCertificationScore(memory.Certification)
	
	// Calculate weighted score
	totalScore := (qualityScore * qualityWeight) +
		(creditScore * creditWeight) +
		(priceScore * priceWeight) +
		(certScore * certificationWeight)
	
	return totalScore
}

// getCertificationScore returns a score for certification level
func getCertificationScore(certification string) float64 {
	switch certification {
	case "platinum":
		return 1.0
	case "gold":
		return 0.8
	case "silver":
		return 0.6
	case "bronze":
		return 0.4
	default:
		return 0.2
	}
}

// generateExplanation generates a human-readable explanation for the recommendation
func (s *RecommendationService) generateExplanation(memory model.Memory, score float64) string {
	if score >= 0.8 {
		return "Highly recommended: Excellent quality and trusted agent"
	} else if score >= 0.6 {
		return "Good choice: Balanced quality and price"
	} else if score >= 0.4 {
		return "Budget option: Acceptable quality at lower price"
	} else {
		return "Consider alternatives: Lower quality or untrusted agent"
	}
}
