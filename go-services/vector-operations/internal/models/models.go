package models

import "time"

// Vector represents a latent space vector
type Vector struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Embedding   []float64 `json:"embedding"`
	Dimension   int       `json:"dimension"`
	CreatorID   string    `json:"creator_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// VectorSearchRequest represents a similarity search request
type VectorSearchRequest struct {
	QueryVector []float64 `json:"query_vector" binding:"required"`
	TopK        int       `json:"top_k" binding:"required,min=1,max=100"`
	Threshold   float64   `json:"threshold,omitempty"`
}

// VectorSearchResult represents a search result
type VectorSearchResult struct {
	Vector     Vector  `json:"vector"`
	Similarity float64 `json:"similarity"`
	Distance   float64 `json:"distance"`
}

// BatchVectorRequest represents a batch operation request
type BatchVectorRequest struct {
	Vectors []Vector `json:"vectors" binding:"required"`
}

// VectorStats represents vector storage statistics
type VectorStats struct {
	TotalVectors    int     `json:"total_vectors"`
	AvgDimension    float64 `json:"avg_dimension"`
	TotalCreators   int     `json:"total_creators"`
	StorageSize     int64   `json:"storage_size_bytes"`
	LastUpdated     string  `json:"last_updated"`
}
