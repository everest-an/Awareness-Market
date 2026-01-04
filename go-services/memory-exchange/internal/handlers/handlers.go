package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/awareness/memory-exchange/internal/database"
	"github.com/awareness/memory-exchange/internal/models"

	"github.com/gin-gonic/gin"
)
// PublishMemory handles publishing a new memory to the exchange
func PublishMemory(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   stringPtr("User not authenticated"),
		})
		return
	}

	var req models.PublishMemoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   stringPtr("Invalid request body: " + err.Error()),
		})
		return
	}

	// Serialize KV cache data
	kvCacheJSON, err := json.Marshal(req.KVCacheData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Failed to serialize KV cache data"),
		})
		return
	}

	// Insert into database
	query := `
		INSERT INTO memory_exchanges (
			seller_id, memory_type, kv_cache_data, price, status, created_at
		) VALUES (?, ?, ?, ?, 'pending', NOW())
	`

	result, err := database.DB.Exec(query, userID, req.MemoryType, string(kvCacheJSON), req.Price)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Failed to publish memory: " + err.Error()),
		})
		return
	}

	memoryID, _ := result.LastInsertId()

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"memory_id": memoryID,
			"message":   "Memory published successfully",
		},
	})
}

// PurchaseMemory handles purchasing a memory from the exchange
func PurchaseMemory(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   stringPtr("User not authenticated"),
		})
		return
	}

	var req models.PurchaseMemoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   stringPtr("Invalid request body: " + err.Error()),
		})
		return
	}

	// Check if memory exists and is available
	var memory models.MemoryExchange
	query := `
		SELECT id, seller_id, memory_type, kv_cache_data, price, status
		FROM memory_exchanges
		WHERE id = ?
	`

	err := database.DB.QueryRow(query, req.MemoryID).Scan(
		&memory.ID,
		&memory.SellerID,
		&memory.MemoryType,
		&memory.KVCacheData,
		&memory.Price,
		&memory.Status,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error:   stringPtr("Memory not found"),
		})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error"),
		})
		return
	}

	if memory.Status != "pending" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   stringPtr("Memory is not available for purchase"),
		})
		return
	}

	// Update memory exchange with buyer info
	updateQuery := `
		UPDATE memory_exchanges
		SET buyer_id = ?, target_model = ?, status = 'completed'
		WHERE id = ?
	`

	_, err = database.DB.Exec(updateQuery, userID, req.TargetModel, req.MemoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Failed to complete purchase"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"memory_id":     memory.ID,
			"kv_cache_data": memory.KVCacheData,
			"price":         memory.Price,
			"message":       "Memory purchased successfully",
		},
	})
}

// BrowseMemories handles browsing available memories
func BrowseMemories(c *gin.Context) {
	var req models.BrowseMemoriesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   stringPtr("Invalid query parameters"),
		})
		return
	}

	// Build query
	query := `
		SELECT id, seller_id, memory_type, price, status, created_at
		FROM memory_exchanges
		WHERE status = 'pending'
	`
	args := []interface{}{}

	if req.MemoryType != nil {
		query += " AND memory_type = ?"
		args = append(args, *req.MemoryType)
	}

	if req.SourceModel != nil {
		query += " AND source_model = ?"
		args = append(args, *req.SourceModel)
	}

	if req.MinPrice != nil {
		query += " AND price >= ?"
		args = append(args, *req.MinPrice)
	}

	if req.MaxPrice != nil {
		query += " AND price <= ?"
		args = append(args, *req.MaxPrice)
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, req.Limit, req.Offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error"),
		})
		return
	}
	defer rows.Close()

	memories := []models.MemoryExchange{}
	for rows.Next() {
		var memory models.MemoryExchange
		err := rows.Scan(
			&memory.ID,
			&memory.SellerID,
			&memory.MemoryType,
			&memory.Price,
			&memory.Status,
			&memory.CreatedAt,
		)
		if err != nil {
			continue
		}
		memories = append(memories, memory)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"memories": memories,
			"total":    len(memories),
		},
	})
}

// PublishReasoningChain handles publishing a reasoning chain
func PublishReasoningChain(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   stringPtr("User not authenticated"),
		})
		return
	}

	var req models.PublishReasoningChainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   stringPtr("Invalid request body: " + err.Error()),
		})
		return
	}

	// Serialize JSON fields
	kvCacheJSON, _ := json.Marshal(req.KVCacheSnapshot)
	var inputExampleJSON, outputExampleJSON *string
	if req.InputExample != nil {
		data, _ := json.Marshal(req.InputExample)
		str := string(data)
		inputExampleJSON = &str
	}
	if req.OutputExample != nil {
		data, _ := json.Marshal(req.OutputExample)
		str := string(data)
		outputExampleJSON = &str
	}

	// Insert into database
	query := `
		INSERT INTO reasoning_chains (
			creator_id, chain_name, description, category,
			input_example, output_example, kv_cache_snapshot,
			source_model, step_count, price_per_use,
			avg_quality, review_count, usage_count, total_revenue,
			status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 'active', NOW(), NOW())
	`

	result, err := database.DB.Exec(query,
		userID, req.ChainName, req.Description, req.Category,
		inputExampleJSON, outputExampleJSON, string(kvCacheJSON),
		req.SourceModel, req.StepCount, req.PricePerUse,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Failed to publish reasoning chain: " + err.Error()),
		})
		return
	}

	chainID, _ := result.LastInsertId()

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"chain_id": chainID,
			"message":  "Reasoning chain published successfully",
		},
	})
}

// UseReasoningChain handles using a reasoning chain
func UseReasoningChain(c *gin.Context) {
	_, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   stringPtr("User not authenticated"),
		})
		return
	}

	var req models.UseReasoningChainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   stringPtr("Invalid request body: " + err.Error()),
		})
		return
	}

	// Get reasoning chain
	var chain models.ReasoningChain
	query := `
		SELECT id, creator_id, kv_cache_snapshot, price_per_use, usage_count, total_revenue
		FROM reasoning_chains
		WHERE id = ? AND status = 'active'
	`

	err := database.DB.QueryRow(query, req.ChainID).Scan(
		&chain.ID,
		&chain.CreatorID,
		&chain.KVCacheSnapshot,
		&chain.PricePerUse,
		&chain.UsageCount,
		&chain.TotalRevenue,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error:   stringPtr("Reasoning chain not found"),
		})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error"),
		})
		return
	}

	// Update usage stats
	updateQuery := `
		UPDATE reasoning_chains
		SET usage_count = usage_count + 1,
		    total_revenue = total_revenue + ?,
		    updated_at = NOW()
		WHERE id = ?
	`

	_, err = database.DB.Exec(updateQuery, chain.PricePerUse, req.ChainID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Failed to update usage stats"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"chain_id":          chain.ID,
			"kv_cache_snapshot": chain.KVCacheSnapshot,
			"price_charged":     chain.PricePerUse,
			"message":           "Reasoning chain executed successfully",
		},
	})
}

// BrowseReasoningChains handles browsing reasoning chains
func BrowseReasoningChains(c *gin.Context) {
	var req models.BrowseReasoningChainsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   stringPtr("Invalid query parameters"),
		})
		return
	}

	// Build query
	query := `
		SELECT id, creator_id, chain_name, description, category,
		       source_model, step_count, avg_quality, review_count,
		       price_per_use, usage_count, total_revenue, status, created_at
		FROM reasoning_chains
		WHERE status = 'active'
	`
	args := []interface{}{}

	if req.Category != nil {
		query += " AND category = ?"
		args = append(args, *req.Category)
	}

	if req.SourceModel != nil {
		query += " AND source_model = ?"
		args = append(args, *req.SourceModel)
	}

	if req.MinPrice != nil {
		query += " AND price_per_use >= ?"
		args = append(args, *req.MinPrice)
	}

	if req.MaxPrice != nil {
		query += " AND price_per_use <= ?"
		args = append(args, *req.MaxPrice)
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, req.Limit, req.Offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error"),
		})
		return
	}
	defer rows.Close()

	chains := []models.ReasoningChain{}
	for rows.Next() {
		var chain models.ReasoningChain
		err := rows.Scan(
			&chain.ID,
			&chain.CreatorID,
			&chain.ChainName,
			&chain.Description,
			&chain.Category,
			&chain.SourceModel,
			&chain.StepCount,
			&chain.AvgQuality,
			&chain.ReviewCount,
			&chain.PricePerUse,
			&chain.UsageCount,
			&chain.TotalRevenue,
			&chain.Status,
			&chain.CreatedAt,
		)
		if err != nil {
			continue
		}
		chains = append(chains, chain)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"chains": chains,
			"total":  len(chains),
		},
	})
}

// GetStats returns memory exchange statistics
func GetStats(c *gin.Context) {
	var stats struct {
		TotalMemories       int     `json:"total_memories"`
		TotalChains         int     `json:"total_chains"`
		TotalTransactions   int     `json:"total_transactions"`
		TotalVolume         float64 `json:"total_volume"`
		AvgMemoryPrice      float64 `json:"avg_memory_price"`
		AvgChainPrice       float64 `json:"avg_chain_price"`
		ActiveMemories      int     `json:"active_memories"`
		ActiveChains        int     `json:"active_chains"`
	}

	// Get memory stats
	database.DB.QueryRow(`
		SELECT COUNT(*), COALESCE(AVG(price), 0)
		FROM memory_exchanges
	`).Scan(&stats.TotalMemories, &stats.AvgMemoryPrice)

	database.DB.QueryRow(`
		SELECT COUNT(*)
		FROM memory_exchanges
		WHERE status = 'pending'
	`).Scan(&stats.ActiveMemories)

	// Get chain stats
	database.DB.QueryRow(`
		SELECT COUNT(*), COALESCE(AVG(price_per_use), 0)
		FROM reasoning_chains
	`).Scan(&stats.TotalChains, &stats.AvgChainPrice)

	database.DB.QueryRow(`
		SELECT COUNT(*)
		FROM reasoning_chains
		WHERE status = 'active'
	`).Scan(&stats.ActiveChains)

	// Get transaction stats
	database.DB.QueryRow(`
		SELECT COUNT(*), COALESCE(SUM(price), 0)
		FROM memory_exchanges
		WHERE status = 'completed'
	`).Scan(&stats.TotalTransactions, &stats.TotalVolume)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stats,
	})
}

// GetMyHistory returns user's memory exchange history
func GetMyHistory(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   stringPtr("User not authenticated"),
		})
		return
	}

	role := c.DefaultQuery("role", "both")
	limitStr := c.DefaultQuery("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	query := `
		SELECT id, seller_id, buyer_id, memory_type, price, status, created_at
		FROM memory_exchanges
		WHERE 1=1
	`
	args := []interface{}{}

	if role == "seller" || role == "both" {
		query += " AND seller_id = ?"
		args = append(args, userID)
	}

	if role == "buyer" || role == "both" {
		if role == "both" {
			query += " OR buyer_id = ?"
		} else {
			query += " AND buyer_id = ?"
		}
		args = append(args, userID)
	}

	query += " ORDER BY created_at DESC LIMIT ?"
	args = append(args, limit)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error"),
		})
		return
	}
	defer rows.Close()

	history := []models.MemoryExchange{}
	for rows.Next() {
		var memory models.MemoryExchange
		err := rows.Scan(
			&memory.ID,
			&memory.SellerID,
			&memory.BuyerID,
			&memory.MemoryType,
			&memory.Price,
			&memory.Status,
			&memory.CreatedAt,
		)
		if err != nil {
			continue
		}
		history = append(history, memory)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"history": history,
			"total":   len(history),
		},
	})
}

// Helper function
func stringPtr(s string) *string {
	return &s
}
