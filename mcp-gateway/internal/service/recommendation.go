package service

import (
	"context"
	"fmt"
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
	type PackageResponse struct {
		ID            int     `json:"id"`
		PackageID     string  `json:"packageId"`
		Name          string  `json:"name"`
		Description   string  `json:"description"`
		Price         string  `json:"price"`
		Status        string  `json:"status"`
		CreatorID     int     `json:"creatorId"`
		InformationRetention string `json:"informationRetention"`
	}

	type WMatrixResponse struct {
		ID              int     `json:"id"`
		Title           string  `json:"title"`
		Description     string  `json:"description"`
		SourceModel     string  `json:"sourceModel"`
		TargetModel     string  `json:"targetModel"`
		Price           float64 `json:"price"`
		AverageEpsilon  float64 `json:"averageEpsilon"`
		Status          string  `json:"status"`
	}

	var allMemories []model.Memory

	// Fetch packages (KV-Cache and Reasoning Chains)
	queryParams := fmt.Sprintf("?limit=%d", req.Limit)
	if req.MaxBudget > 0 {
		queryParams += fmt.Sprintf("&maxPrice=%.2f", req.MaxBudget)
	}

	// Fetch KV-Cache packages
	if len(req.PreferredTypes) == 0 || contains(req.PreferredTypes, "kv-cache") {
		var kvPackages []PackageResponse
		kvParams := queryParams + "&packageType=memory"
		if err := s.apiClient.Get(ctx, "/api/trpc/packages.browsePackages"+kvParams, &kvPackages); err == nil {
			for _, pkg := range kvPackages {
				price := 0.0
				fmt.Sscanf(pkg.Price, "%f", &price)
				epsilon := 0.05
				if ir, err := fmt.Sscanf(pkg.InformationRetention, "%f", &epsilon); err == nil && ir == 1 {
					epsilon = 1.0 - epsilon
				}

				allMemories = append(allMemories, model.Memory{
					ID:               pkg.PackageID,
					Type:             "kv-cache",
					Name:             pkg.Name,
					Description:      pkg.Description,
					Epsilon:          epsilon,
					Certification:    "gold",
					Price:            price,
					AgentAddress:     fmt.Sprintf("0x%040d", pkg.CreatorID),
					AgentCreditScore: 700, // Would fetch from agent credit API
				})
			}
		}
	}

	// Fetch Reasoning Chain packages
	if len(req.PreferredTypes) == 0 || contains(req.PreferredTypes, "reasoning-chain") {
		var chainPackages []PackageResponse
		chainParams := queryParams + "&packageType=chain"
		if err := s.apiClient.Get(ctx, "/api/trpc/packages.browsePackages"+chainParams, &chainPackages); err == nil {
			for _, pkg := range chainPackages {
				price := 0.0
				fmt.Sscanf(pkg.Price, "%f", &price)
				epsilon := 0.05
				if ir, err := fmt.Sscanf(pkg.InformationRetention, "%f", &epsilon); err == nil && ir == 1 {
					epsilon = 1.0 - epsilon
				}

				allMemories = append(allMemories, model.Memory{
					ID:               pkg.PackageID,
					Type:             "reasoning-chain",
					Name:             pkg.Name,
					Description:      pkg.Description,
					Epsilon:          epsilon,
					Certification:    "silver",
					Price:            price,
					AgentAddress:     fmt.Sprintf("0x%040d", pkg.CreatorID),
					AgentCreditScore: 650,
				})
			}
		}
	}

	// Fetch W-Matrix listings
	if len(req.PreferredTypes) == 0 || contains(req.PreferredTypes, "w-matrix") {
		var wMatrices []WMatrixResponse
		wParams := queryParams
		if req.SourceModel != "" {
			wParams += "&sourceModel=" + req.SourceModel
		}
		if req.TargetModel != "" {
			wParams += "&targetModel=" + req.TargetModel
		}

		if err := s.apiClient.Get(ctx, "/api/trpc/wMatrix.browseListings"+wParams, &wMatrices); err == nil {
			for _, wm := range wMatrices {
				if wm.Status == "active" {
					allMemories = append(allMemories, model.Memory{
						ID:               fmt.Sprintf("wm-%d", wm.ID),
						Type:             "w-matrix",
						Name:             wm.Title,
						Description:      wm.Description,
						Epsilon:          wm.AverageEpsilon,
						Certification:    "gold",
						Price:            wm.Price,
						AgentAddress:     fmt.Sprintf("0x%040d", wm.ID),
						AgentCreditScore: 750,
					})
				}
			}
		}
	}

	// Filter by minimum credit score if specified
	if req.MinCreditScore > 0 {
		filtered := []model.Memory{}
		for _, mem := range allMemories {
			if mem.AgentCreditScore >= req.MinCreditScore {
				filtered = append(filtered, mem)
			}
		}
		allMemories = filtered
	}

	return allMemories, nil
}

// contains checks if a string slice contains a specific value
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
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
