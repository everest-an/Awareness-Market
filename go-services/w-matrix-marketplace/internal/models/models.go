package models

import "time"

// WMatrixListing represents a W-Matrix listing in the marketplace
type WMatrixListing struct {
	ID                  int       `json:"id"`
	CreatorID           int       `json:"creator_id"`
	Title               string    `json:"title"`
	Description         string    `json:"description"`
	SourceModel         string    `json:"source_model"`
	TargetModel         string    `json:"target_model"`
	SourceDim           int       `json:"source_dim"`
	TargetDim           int       `json:"target_dim"`
	MatrixID            string    `json:"matrix_id"`
	MatrixFileURL       string    `json:"matrix_file_url"`
	Price               float64   `json:"price"`
	AlignmentLoss       float64   `json:"alignment_loss"`
	TrainingDataSize    int       `json:"training_data_size"`
	TotalSales          int       `json:"total_sales"`
	TotalRevenue        float64   `json:"total_revenue"`
	AverageRating       float64   `json:"average_rating"`
	RatingCount         int       `json:"rating_count"`
	Status              string    `json:"status"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// WMatrixPurchase represents a purchase record
type WMatrixPurchase struct {
	ID                     int       `json:"id"`
	ListingID              int       `json:"listing_id"`
	BuyerID                int       `json:"buyer_id"`
	PurchasePrice          float64   `json:"purchase_price"`
	StripePaymentIntentID  string    `json:"stripe_payment_intent_id"`
	DownloadURL            string    `json:"download_url"`
	DownloadExpiresAt      time.Time `json:"download_expires_at"`
	Rating                 *int      `json:"rating,omitempty"`
	Review                 *string   `json:"review,omitempty"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

// CreateListingRequest represents a request to create a listing
type CreateListingRequest struct {
	Title            string  `json:"title" binding:"required"`
	Description      string  `json:"description" binding:"required"`
	SourceModel      string  `json:"source_model" binding:"required"`
	TargetModel      string  `json:"target_model" binding:"required"`
	SourceDim        int     `json:"source_dim" binding:"required,min=1"`
	TargetDim        int     `json:"target_dim" binding:"required,min=1"`
	Price            float64 `json:"price" binding:"required,min=0"`
	AlignmentLoss    float64 `json:"alignment_loss" binding:"required,min=0"`
	TrainingDataSize int     `json:"training_data_size" binding:"required,min=1"`
}

// PurchaseListingRequest represents a request to purchase a listing
type PurchaseListingRequest struct {
	ListingID             int    `json:"listing_id" binding:"required"`
	StripePaymentIntentID string `json:"stripe_payment_intent_id" binding:"required"`
}

// RateListingRequest represents a request to rate a purchased listing
type RateListingRequest struct {
	PurchaseID int    `json:"purchase_id" binding:"required"`
	Rating     int    `json:"rating" binding:"required,min=1,max=5"`
	Review     string `json:"review"`
}

// BrowseListingsRequest represents query parameters for browsing
type BrowseListingsRequest struct {
	SourceModel *string  `form:"source_model"`
	TargetModel *string  `form:"target_model"`
	MinPrice    *float64 `form:"min_price"`
	MaxPrice    *float64 `form:"max_price"`
	SortBy      string   `form:"sort_by"` // "newest", "price_asc", "price_desc", "rating", "sales"
	Limit       int      `form:"limit" binding:"min=1,max=100"`
	Offset      int      `form:"offset" binding:"min=0"`
}

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *string     `json:"error,omitempty"`
}
