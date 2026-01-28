package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/awareness-market/mcp-gateway/internal/model"
	"github.com/awareness-market/mcp-gateway/pkg/client"
	"golang.org/x/sync/errgroup"
)

// MemoryDiscoveryService handles concurrent memory discovery across multiple sources
type MemoryDiscoveryService struct {
	apiClient *client.AwarenessAPIClient
}

// NewMemoryDiscoveryService creates a new memory discovery service
func NewMemoryDiscoveryService(apiClient *client.AwarenessAPIClient) *MemoryDiscoveryService {
	return &MemoryDiscoveryService{
		apiClient: apiClient,
	}
}

// DiscoverMemories discovers relevant memories for a given context using concurrent queries
func (s *MemoryDiscoveryService) DiscoverMemories(ctx context.Context, req *model.DiscoveryRequest) (*model.DiscoveryResponse, error) {
	startTime := time.Now()

	// Create error group for concurrent operations
	g, ctx := errgroup.WithContext(ctx)
	
	// Results channels
	kvCacheChan := make(chan []model.Memory, 1)
	wMatrixChan := make(chan []model.Memory, 1)
	reasoningChainChan := make(chan []model.Memory, 1)

	// Concurrent query for KV-Cache memories
	g.Go(func() error {
		memories, err := s.queryKVCacheMemories(ctx, req)
		if err != nil {
			return fmt.Errorf("kv-cache query failed: %w", err)
		}
		kvCacheChan <- memories
		return nil
	})

	// Concurrent query for W-Matrix memories
	g.Go(func() error {
		memories, err := s.queryWMatrixMemories(ctx, req)
		if err != nil {
			return fmt.Errorf("w-matrix query failed: %w", err)
		}
		wMatrixChan <- memories
		return nil
	})

	// Concurrent query for Reasoning Chain memories
	g.Go(func() error {
		memories, err := s.queryReasoningChainMemories(ctx, req)
		if err != nil {
			return fmt.Errorf("reasoning-chain query failed: %w", err)
		}
		reasoningChainChan <- memories
		return nil
	})

	// Wait for all queries to complete
	if err := g.Wait(); err != nil {
		return nil, err
	}

	// Collect results
	var allMemories []model.Memory
	allMemories = append(allMemories, <-kvCacheChan...)
	allMemories = append(allMemories, <-wMatrixChan...)
	allMemories = append(allMemories, <-reasoningChainChan...)

	// Sort by relevance score
	sortMemoriesByRelevance(allMemories)

	// Apply limit
	if req.Limit > 0 && len(allMemories) > req.Limit {
		allMemories = allMemories[:req.Limit]
	}

	return &model.DiscoveryResponse{
		Memories:      allMemories,
		TotalFound:    len(allMemories),
		QueryTimeMs:   time.Since(startTime).Milliseconds(),
		SourcesQueried: []string{"kv-cache", "w-matrix", "reasoning-chain"},
	}, nil
}

// BatchDiscoverMemories discovers memories for multiple contexts concurrently
func (s *MemoryDiscoveryService) BatchDiscoverMemories(ctx context.Context, requests []*model.DiscoveryRequest) ([]*model.DiscoveryResponse, error) {
	results := make([]*model.DiscoveryResponse, len(requests))
	var mu sync.Mutex
	
	g, ctx := errgroup.WithContext(ctx)
	
	// Process each request concurrently
	for i, req := range requests {
		i, req := i, req // Capture loop variables
		g.Go(func() error {
			resp, err := s.DiscoverMemories(ctx, req)
			if err != nil {
				return err
			}
			
			mu.Lock()
			results[i] = resp
			mu.Unlock()
			
			return nil
		})
	}
	
	if err := g.Wait(); err != nil {
		return nil, err
	}
	
	return results, nil
}

// queryKVCacheMemories queries KV-Cache memories from the API
func (s *MemoryDiscoveryService) queryKVCacheMemories(ctx context.Context, req *model.DiscoveryRequest) ([]model.Memory, error) {
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

	var packages []PackageResponse
	queryParams := fmt.Sprintf("?packageType=memory&limit=%d", req.Limit)
	if req.MaxPrice > 0 {
		queryParams += fmt.Sprintf("&maxPrice=%.2f", req.MaxPrice)
	}

	if err := s.apiClient.Get(ctx, "/api/trpc/packages.browsePackages"+queryParams, &packages); err != nil {
		return nil, fmt.Errorf("failed to fetch KV-Cache memories: %w", err)
	}

	memories := make([]model.Memory, 0, len(packages))
	for _, pkg := range packages {
		price := 0.0
		if p, err := fmt.Sscanf(pkg.Price, "%f", &price); err == nil && p == 1 {
			epsilon := 0.05 // default
			if ir, err := fmt.Sscanf(pkg.InformationRetention, "%f", &epsilon); err == nil && ir == 1 {
				epsilon = 1.0 - epsilon // convert retention to epsilon
			}

			memories = append(memories, model.Memory{
				ID:             pkg.PackageID,
				Type:           "kv-cache",
				Name:           pkg.Name,
				Description:    pkg.Description,
				Epsilon:        epsilon,
				Certification:  "gold",
				Price:          price,
				RelevanceScore: calculateRelevance(req.Context, pkg.Name+" "+pkg.Description),
			})
		}
	}

	return memories, nil
}

// queryWMatrixMemories queries W-Matrix memories from the API
func (s *MemoryDiscoveryService) queryWMatrixMemories(ctx context.Context, req *model.DiscoveryRequest) ([]model.Memory, error) {
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

	var wMatrices []WMatrixResponse
	queryParams := fmt.Sprintf("?limit=%d", req.Limit)
	if req.SourceModel != "" {
		queryParams += "&sourceModel=" + req.SourceModel
	}
	if req.TargetModel != "" {
		queryParams += "&targetModel=" + req.TargetModel
	}
	if req.MaxPrice > 0 {
		queryParams += fmt.Sprintf("&maxPrice=%.2f", req.MaxPrice)
	}

	if err := s.apiClient.Get(ctx, "/api/trpc/wMatrix.browseListings"+queryParams, &wMatrices); err != nil {
		return nil, fmt.Errorf("failed to fetch W-Matrix memories: %w", err)
	}

	memories := make([]model.Memory, 0, len(wMatrices))
	for _, wm := range wMatrices {
		if wm.Status == "active" {
			memories = append(memories, model.Memory{
				ID:             fmt.Sprintf("wm-%d", wm.ID),
				Type:           "w-matrix",
				Name:           wm.Title,
				Description:    wm.Description,
				Epsilon:        wm.AverageEpsilon,
				Certification:  "gold",
				Price:          wm.Price,
				RelevanceScore: calculateRelevance(req.Context, wm.Title+" "+wm.Description),
			})
		}
	}

	return memories, nil
}

// queryReasoningChainMemories queries Reasoning Chain memories from the API
func (s *MemoryDiscoveryService) queryReasoningChainMemories(ctx context.Context, req *model.DiscoveryRequest) ([]model.Memory, error) {
	type ChainPackageResponse struct {
		ID            int     `json:"id"`
		PackageID     string  `json:"packageId"`
		Name          string  `json:"name"`
		Description   string  `json:"description"`
		Price         string  `json:"price"`
		Status        string  `json:"status"`
		InformationRetention string `json:"informationRetention"`
	}

	var packages []ChainPackageResponse
	queryParams := fmt.Sprintf("?packageType=chain&limit=%d", req.Limit)
	if req.MaxPrice > 0 {
		queryParams += fmt.Sprintf("&maxPrice=%.2f", req.MaxPrice)
	}

	if err := s.apiClient.Get(ctx, "/api/trpc/packages.browsePackages"+queryParams, &packages); err != nil {
		return nil, fmt.Errorf("failed to fetch Reasoning Chain memories: %w", err)
	}

	memories := make([]model.Memory, 0, len(packages))
	for _, pkg := range packages {
		price := 0.0
		if p, err := fmt.Sscanf(pkg.Price, "%f", &price); err == nil && p == 1 {
			epsilon := 0.05 // default
			if ir, err := fmt.Sscanf(pkg.InformationRetention, "%f", &epsilon); err == nil && ir == 1 {
				epsilon = 1.0 - epsilon // convert retention to epsilon
			}

			memories = append(memories, model.Memory{
				ID:             pkg.PackageID,
				Type:           "reasoning-chain",
				Name:           pkg.Name,
				Description:    pkg.Description,
				Epsilon:        epsilon,
				Certification:  "silver",
				Price:          price,
				RelevanceScore: calculateRelevance(req.Context, pkg.Name+" "+pkg.Description),
			})
		}
	}

	return memories, nil
}

// calculateRelevance calculates relevance score between context and memory description
func calculateRelevance(context, description string) float64 {
	// Convert both to lowercase for case-insensitive matching
	contextLower := strings.ToLower(context)
	descLower := strings.ToLower(description)

	// Tokenize context into words
	contextWords := tokenize(contextLower)
	descWords := tokenize(descLower)

	if len(contextWords) == 0 || len(descWords) == 0 {
		return 0.5 // neutral score for empty inputs
	}

	// Calculate word overlap (Jaccard similarity)
	contextSet := make(map[string]bool)
	for _, word := range contextWords {
		contextSet[word] = true
	}

	descSet := make(map[string]bool)
	for _, word := range descWords {
		descSet[word] = true
	}

	intersection := 0
	for word := range contextSet {
		if descSet[word] {
			intersection++
		}
	}

	union := len(contextSet)
	for word := range descSet {
		if !contextSet[word] {
			union++
		}
	}

	jaccardScore := float64(intersection) / float64(union)

	// Add substring bonus if context is contained in description
	substringBonus := 0.0
	if strings.Contains(descLower, contextLower) {
		substringBonus = 0.2
	}

	// Combine scores (Jaccard * 0.8 + substring bonus * 0.2)
	relevanceScore := (jaccardScore * 0.8) + substringBonus

	// Clamp to [0, 1] range
	if relevanceScore > 1.0 {
		relevanceScore = 1.0
	}
	if relevanceScore < 0.0 {
		relevanceScore = 0.0
	}

	return relevanceScore
}

// tokenize splits a string into words, removing punctuation and short words
func tokenize(text string) []string {
	var words []string
	var currentWord strings.Builder

	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			currentWord.WriteRune(r)
		} else {
			if currentWord.Len() > 0 {
				word := currentWord.String()
				if len(word) > 2 { // ignore very short words
					words = append(words, word)
				}
				currentWord.Reset()
			}
		}
	}

	// Add last word if any
	if currentWord.Len() > 0 {
		word := currentWord.String()
		if len(word) > 2 {
			words = append(words, word)
		}
	}

	return words
}

// sortMemoriesByRelevance sorts memories by relevance score in descending order
func sortMemoriesByRelevance(memories []model.Memory) {
	// Simple bubble sort for now (replace with more efficient algorithm if needed)
	for i := 0; i < len(memories); i++ {
		for j := i + 1; j < len(memories); j++ {
			if memories[i].RelevanceScore < memories[j].RelevanceScore {
				memories[i], memories[j] = memories[j], memories[i]
			}
		}
	}
}
