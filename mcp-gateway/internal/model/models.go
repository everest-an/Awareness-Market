package model

// Memory represents a memory asset in the marketplace
type Memory struct {
	ID               string  `json:"id"`
	Type             string  `json:"type"` // kv-cache, w-matrix, reasoning-chain
	Name             string  `json:"name"`
	Description      string  `json:"description"`
	Epsilon          float64 `json:"epsilon"`
	Certification    string  `json:"certification"` // platinum, gold, silver, bronze
	Price            float64 `json:"price"`
	AgentAddress     string  `json:"agentAddress"`
	AgentCreditScore int     `json:"agentCreditScore"`
	RelevanceScore   float64 `json:"relevanceScore,omitempty"`
}

// DiscoveryRequest represents a memory discovery request
type DiscoveryRequest struct {
	Context      string   `json:"context"`      // User's current context/query
	SourceModel  string   `json:"sourceModel"`  // Source AI model
	TargetModel  string   `json:"targetModel"`  // Target AI model (for W-Matrix)
	MemoryTypes  []string `json:"memoryTypes"`  // Filter by memory types
	MinQuality   float64  `json:"minQuality"`   // Minimum quality (max epsilon)
	MaxPrice     float64  `json:"maxPrice"`     // Maximum price
	Limit        int      `json:"limit"`        // Maximum number of results
}

// DiscoveryResponse represents the response from memory discovery
type DiscoveryResponse struct {
	Memories       []Memory `json:"memories"`
	TotalFound     int      `json:"totalFound"`
	QueryTimeMs    int64    `json:"queryTimeMs"`
	SourcesQueried []string `json:"sourcesQueried"`
}

// RecommendationRequest represents a recommendation request
type RecommendationRequest struct {
	Context         string   `json:"context"`
	SourceModel     string   `json:"sourceModel"`
	TargetModel     string   `json:"targetModel,omitempty"`
	PreferredTypes  []string `json:"preferredTypes,omitempty"`
	MaxBudget       float64  `json:"maxBudget,omitempty"`
	MinCreditScore  int      `json:"minCreditScore,omitempty"`
	Limit           int      `json:"limit"`
}

// ScoredMemory represents a memory with recommendation score
type ScoredMemory struct {
	Memory              Memory  `json:"memory"`
	RecommendationScore float64 `json:"recommendationScore"`
	Explanation         string  `json:"explanation"`
}

// RecommendationResponse represents the response from recommendation service
type RecommendationResponse struct {
	Recommendations []ScoredMemory `json:"recommendations"`
	TotalFound      int            `json:"totalFound"`
}

// BatchDiscoveryRequest represents a batch discovery request
type BatchDiscoveryRequest struct {
	Requests []*DiscoveryRequest `json:"requests"`
}

// BatchDiscoveryResponse represents the response from batch discovery
type BatchDiscoveryResponse struct {
	Responses []*DiscoveryResponse `json:"responses"`
	TotalTimeMs int64              `json:"totalTimeMs"`
}
