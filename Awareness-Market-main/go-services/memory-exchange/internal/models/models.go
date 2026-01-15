package models

import (
	"time"
)

// MemoryExchange represents a KV-cache trading record
type MemoryExchange struct {
	ID               int       `json:"id"`
	SellerID         int       `json:"seller_id"`
	BuyerID          int       `json:"buyer_id"`
	MemoryType       string    `json:"memory_type"` // kv_cache, reasoning_chain, long_term_memory
	KVCacheData      string    `json:"kv_cache_data"` // JSON serialized
	WMatrixVersion   *string   `json:"w_matrix_version,omitempty"`
	SourceModel      *string   `json:"source_model,omitempty"`
	TargetModel      *string   `json:"target_model,omitempty"`
	ContextLength    *int      `json:"context_length,omitempty"`
	TokenCount       *int      `json:"token_count,omitempty"`
	Price            float64   `json:"price"`
	QualityScore     *float64  `json:"quality_score,omitempty"`
	AlignmentQuality *string   `json:"alignment_quality,omitempty"` // JSON
	Status           string    `json:"status"` // pending, completed, failed
	CreatedAt        time.Time `json:"created_at"`
}

// ReasoningChain represents a reusable reasoning process
type ReasoningChain struct {
	ID               int       `json:"id"`
	CreatorID        int       `json:"creator_id"`
	ChainName        string    `json:"chain_name"`
	Description      string    `json:"description"`
	Category         string    `json:"category"`
	InputExample     *string   `json:"input_example,omitempty"` // JSON
	OutputExample    *string   `json:"output_example,omitempty"` // JSON
	KVCacheSnapshot  *string   `json:"kv_cache_snapshot,omitempty"` // JSON
	SourceModel      string    `json:"source_model"`
	WMatrixVersion   *string   `json:"w_matrix_version,omitempty"`
	StepCount        *int      `json:"step_count,omitempty"`
	AvgQuality       float64   `json:"avg_quality"`
	ReviewCount      int       `json:"review_count"`
	PricePerUse      float64   `json:"price_per_use"`
	UsageCount       int       `json:"usage_count"`
	TotalRevenue     float64   `json:"total_revenue"`
	Status           string    `json:"status"` // draft, active, inactive
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// PublishMemoryRequest represents the request to publish a memory
type PublishMemoryRequest struct {
	MemoryType   string                 `json:"memory_type" binding:"required,oneof=kv_cache reasoning_chain long_term_memory"`
	KVCacheData  map[string]interface{} `json:"kv_cache_data" binding:"required"`
	Price        float64                `json:"price" binding:"required,gt=0"`
	Description  *string                `json:"description,omitempty"`
}

// PurchaseMemoryRequest represents the request to purchase a memory
type PurchaseMemoryRequest struct {
	MemoryID    int    `json:"memory_id" binding:"required"`
	TargetModel string `json:"target_model" binding:"required"`
}

// BrowseMemoriesRequest represents the request to browse memories
type BrowseMemoriesRequest struct {
	MemoryType *string  `form:"memory_type,omitempty"`
	SourceModel *string  `form:"source_model,omitempty"`
	MinPrice   *float64 `form:"min_price,omitempty"`
	MaxPrice   *float64 `form:"max_price,omitempty"`
	Limit      int      `form:"limit,default=20"`
	Offset     int      `form:"offset,default=0"`
}

// PublishReasoningChainRequest represents the request to publish a reasoning chain
type PublishReasoningChainRequest struct {
	ChainName       string                 `json:"chain_name" binding:"required"`
	Description     string                 `json:"description" binding:"required"`
	Category        string                 `json:"category" binding:"required"`
	InputExample    *map[string]interface{} `json:"input_example,omitempty"`
	OutputExample   *map[string]interface{} `json:"output_example,omitempty"`
	KVCacheSnapshot map[string]interface{}  `json:"kv_cache_snapshot" binding:"required"`
	SourceModel     string                  `json:"source_model" binding:"required"`
	StepCount       *int                    `json:"step_count,omitempty"`
	PricePerUse     float64                 `json:"price_per_use" binding:"required,gt=0"`
}

// UseReasoningChainRequest represents the request to use a reasoning chain
type UseReasoningChainRequest struct {
	ChainID     int                    `json:"chain_id" binding:"required"`
	InputData   map[string]interface{} `json:"input_data" binding:"required"`
	TargetModel string                 `json:"target_model" binding:"required"`
}

// BrowseReasoningChainsRequest represents the request to browse reasoning chains
type BrowseReasoningChainsRequest struct {
	Category    *string  `form:"category,omitempty"`
	SourceModel *string  `form:"source_model,omitempty"`
	MinPrice    *float64 `form:"min_price,omitempty"`
	MaxPrice    *float64 `form:"max_price,omitempty"`
	Limit       int      `form:"limit,default=20"`
	Offset      int      `form:"offset,default=0"`
}

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *string     `json:"error,omitempty"`
	Message *string     `json:"message,omitempty"`
}
