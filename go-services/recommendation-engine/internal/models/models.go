package models

import "time"

// Recommendation represents a recommended item
type Recommendation struct {
	ItemID      string  `json:"item_id"`
	ItemType    string  `json:"item_type"` // "reasoning_chain" or "w_matrix"
	Score       float64 `json:"score"`
	Reason      string  `json:"reason"`
	Title       string  `json:"title,omitempty"`
	Description string  `json:"description,omitempty"`
}

// RecommendationRequest represents a request for recommendations
type RecommendationRequest struct {
	UserID string `json:"user_id"`
	Limit  int    `json:"limit"`
	Type   string `json:"type,omitempty"` // Filter by type
}

// RecommendationResponse contains the list of recommendations
type RecommendationResponse struct {
	Recommendations []Recommendation `json:"recommendations"`
	GeneratedAt     time.Time        `json:"generated_at"`
}

// UserInteraction represents a user's interaction with an item
type UserInteraction struct {
	UserID    string    `json:"user_id"`
	ItemID    string    `json:"item_id"`
	ItemType  string    `json:"item_type"`
	Action    string    `json:"action"` // "view", "purchase", "like"
	Timestamp time.Time `json:"timestamp"`
}

// SimilarItemsRequest for finding similar items
type SimilarItemsRequest struct {
	ItemID string `json:"item_id"`
	Limit  int    `json:"limit"`
}
