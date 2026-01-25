package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/awareness/w-matrix-marketplace/internal/database"
	"github.com/awareness/w-matrix-marketplace/internal/models"
	"github.com/awareness/w-matrix-marketplace/internal/storage"
	"github.com/gin-gonic/gin"
)

// CreateListing godoc
// @Summary Create a new W-Matrix listing
// @Description Create a new W-Matrix alignment tool listing for trading
// @Tags listings
// @Accept json
// @Produce json
// @Param request body models.CreateListingRequest true "Listing details"
// @Success 200 {object} map[string]interface{} "Listing created successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Security ApiKeyAuth
// @Router /listings [post]
func CreateListing(c *gin.Context) {
	userID := c.GetInt("user_id")
	
	var req models.CreateListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Generate unique matrix ID
	matrixID := generateMatrixID()

	query := `
		INSERT INTO wMatrixListings 
		(creatorId, title, description, sourceModel, targetModel, sourceDim, targetDim, 
		 matrixId, price, alignmentLoss, trainingDataSize, status, createdAt, updatedAt)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
	`

	result, err := database.DB.Exec(query, userID, req.Title, req.Description, 
		req.SourceModel, req.TargetModel, req.SourceDim, req.TargetDim, 
		matrixID, req.Price, req.AlignmentLoss, req.TrainingDataSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create listing",
		})
		return
	}

	listingID, _ := result.LastInsertId()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"listing_id": listingID,
			"matrix_id":  matrixID,
		},
	})
}

// BrowseListings godoc
// @Summary Browse W-Matrix listings
// @Description Get a list of W-Matrix listings with optional filtering and sorting
// @Tags listings
// @Accept json
// @Produce json
// @Param source_model query string false "Filter by source model"
// @Param target_model query string false "Filter by target model"
// @Param min_price query number false "Minimum price filter"
// @Param max_price query number false "Maximum price filter"
// @Param sort_by query string false "Sort by: newest, price_asc, price_desc, rating, sales"
// @Param limit query int false "Number of results" default(20)
// @Param offset query int false "Pagination offset" default(0)
// @Success 200 {object} map[string]interface{} "List of W-Matrix listings"
// @Failure 400 {object} map[string]interface{} "Invalid request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Security ApiKeyAuth
// @Router /listings [get]
func BrowseListings(c *gin.Context) {
	var req models.BrowseListingsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	if req.Limit == 0 {
		req.Limit = 20
	}

	query := `SELECT id, creatorId, title, description, sourceModel, targetModel, 
	          sourceDim, targetDim, matrixId, price, alignmentLoss, trainingDataSize,
	          totalSales, totalRevenue, averageRating, ratingCount, status, createdAt, updatedAt
	          FROM wMatrixListings WHERE status = 'active'`

	args := []interface{}{}

	if req.SourceModel != nil {
		query += " AND sourceModel = ?"
		args = append(args, *req.SourceModel)
	}
	if req.TargetModel != nil {
		query += " AND targetModel = ?"
		args = append(args, *req.TargetModel)
	}
	if req.MinPrice != nil {
		query += " AND price >= ?"
		args = append(args, *req.MinPrice)
	}
	if req.MaxPrice != nil {
		query += " AND price <= ?"
		args = append(args, *req.MaxPrice)
	}

	switch req.SortBy {
	case "price_asc":
		query += " ORDER BY price ASC"
	case "price_desc":
		query += " ORDER BY price DESC"
	case "rating":
		query += " ORDER BY averageRating DESC"
	case "sales":
		query += " ORDER BY totalSales DESC"
	default:
		query += " ORDER BY createdAt DESC"
	}

	query += " LIMIT ? OFFSET ?"
	args = append(args, req.Limit, req.Offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch listings",
		})
		return
	}
	defer rows.Close()

	listings := []models.WMatrixListing{}
	for rows.Next() {
		var listing models.WMatrixListing
		var avgRating, totalRevenue sql.NullFloat64
		var totalSales, ratingCount sql.NullInt64

		err := rows.Scan(&listing.ID, &listing.CreatorID, &listing.Title, &listing.Description,
			&listing.SourceModel, &listing.TargetModel, &listing.SourceDim, &listing.TargetDim,
			&listing.MatrixID, &listing.Price, &listing.AlignmentLoss, &listing.TrainingDataSize,
			&totalSales, &totalRevenue, &avgRating, &ratingCount, &listing.Status,
			&listing.CreatedAt, &listing.UpdatedAt)
		if err != nil {
			continue
		}

		if totalSales.Valid {
			listing.TotalSales = int(totalSales.Int64)
		}
		if totalRevenue.Valid {
			listing.TotalRevenue = totalRevenue.Float64
		}
		if avgRating.Valid {
			listing.AverageRating = avgRating.Float64
		}
		if ratingCount.Valid {
			listing.RatingCount = int(ratingCount.Int64)
		}

		listings = append(listings, listing)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    listings,
	})
}

// PurchaseListing godoc
// @Summary Purchase a W-Matrix
// @Description Purchase access to a W-Matrix and get a 7-day download URL
// @Tags purchases
// @Accept json
// @Produce json
// @Param request body models.PurchaseListingRequest true "Purchase details"
// @Success 200 {object} map[string]interface{} "Purchase successful with download URL"
// @Failure 400 {object} map[string]interface{} "Invalid request or already purchased"
// @Failure 404 {object} map[string]interface{} "Listing not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Security ApiKeyAuth
// @Router /purchase [post]
func PurchaseListing(c *gin.Context) {
	userID := c.GetInt("user_id")
	
	var req models.PurchaseListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Check if already purchased
	var existingID int
	checkQuery := `SELECT id FROM wMatrixPurchases WHERE listingId = ? AND buyerId = ? LIMIT 1`
	err := database.DB.QueryRow(checkQuery, req.ListingID, userID).Scan(&existingID)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "You have already purchased this W-Matrix",
		})
		return
	}

	// Get listing details
	var price float64
	var matrixID string
	listingQuery := `SELECT price, matrixId FROM wMatrixListings WHERE id = ? AND status = 'active'`
	err = database.DB.QueryRow(listingQuery, req.ListingID).Scan(&price, &matrixID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Listing not found",
		})
		return
	}

	// Generate download URL (valid for 7 days)
	downloadURL, err := storage.GenerateDownloadURL(matrixID, 7*24*60)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate download URL",
		})
		return
	}

	downloadExpiresAt := time.Now().Add(7 * 24 * time.Hour)

	// Insert purchase record
	purchaseQuery := `
		INSERT INTO wMatrixPurchases 
		(listingId, buyerId, purchasePrice, stripePaymentIntentId, downloadUrl, downloadExpiresAt, createdAt, updatedAt)
		VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
	`
	result, err := database.DB.Exec(purchaseQuery, req.ListingID, userID, price, 
		req.StripePaymentIntentID, downloadURL, downloadExpiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create purchase record",
		})
		return
	}

	purchaseID, _ := result.LastInsertId()

	// Update listing stats
	updateQuery := `
		UPDATE wMatrixListings 
		SET totalSales = totalSales + 1, totalRevenue = totalRevenue + ?, updatedAt = NOW()
		WHERE id = ?
	`
	database.DB.Exec(updateQuery, price, req.ListingID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"purchase_id":         purchaseID,
			"download_url":        downloadURL,
			"download_expires_at": downloadExpiresAt,
		},
	})
}

// generateMatrixID generates a unique matrix ID
func generateMatrixID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("wm_%s", hex.EncodeToString(b))
}
