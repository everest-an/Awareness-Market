package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/awareness/memory-exchange/internal/database"
	"github.com/awareness/memory-exchange/internal/models"

	"github.com/gin-gonic/gin"
)

// PublishMemory godoc
// @Summary Publish a new memory to the exchange
// @Description Publish a KV-Cache memory for trading on the marketplace
// @Tags memory
// @Accept json
// @Produce json
// @Param request body models.PublishMemoryRequest true "Memory details"
// @Success 200 {object} models.APIResponse "Memory published successfully"
// @Failure 400 {object} models.APIResponse "Invalid request"
// @Failure 401 {object} models.APIResponse "Unauthorized"
// @Failure 500 {object} models.APIResponse "Internal server error"
// @Security ApiKeyAuth
// @Router /memory/publish [post]
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

// PurchaseMemory godoc
// @Summary Purchase a memory from the exchange
// @Description Purchase access to a KV-Cache memory
// @Tags memory
// @Accept json
// @Produce json
// @Param request body models.PurchaseMemoryRequest true "Purchase details"
// @Success 200 {object} models.APIResponse "Memory purchased successfully"
// @Failure 400 {object} models.APIResponse "Invalid request"
// @Failure 401 {object} models.APIResponse "Unauthorized"
// @Failure 404 {object} models.APIResponse "Memory not found"
// @Failure 500 {object} models.APIResponse "Internal server error"
// @Security ApiKeyAuth
// @Router /memory/purchase [post]
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
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error: " + err.Error()),
		})
		return
	}

	if memory.Status != "available" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   stringPtr("Memory is not available for purchase"),
		})
		return
	}

	// Create transaction record
	txQuery := `
		INSERT INTO memory_exchanges (
			seller_id, buyer_id, memory_type, kv_cache_data, price, status, created_at
		) VALUES (?, ?, ?, ?, ?, 'completed', NOW())
	`

	result, err := database.DB.Exec(txQuery, memory.SellerID, userID, memory.MemoryType, memory.KVCacheData, memory.Price)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Failed to create transaction: " + err.Error()),
		})
		return
	}

	transactionID, _ := result.LastInsertId()

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"transaction_id": transactionID,
			"memory":         memory,
			"message":        "Memory purchased successfully",
		},
	})
}

// BrowseMemories godoc
// @Summary Browse available memories
// @Description Get a list of available memories for purchase with optional filtering
// @Tags memory
// @Accept json
// @Produce json
// @Param memory_type query string false "Filter by memory type"
// @Param min_price query number false "Minimum price filter"
// @Param max_price query number false "Maximum price filter"
// @Param limit query int false "Number of results to return" default(20)
// @Param offset query int false "Offset for pagination" default(0)
// @Success 200 {object} models.APIResponse "List of memories"
// @Failure 500 {object} models.APIResponse "Internal server error"
// @Security ApiKeyAuth
// @Router /memory/browse [get]
func BrowseMemories(c *gin.Context) {
	memoryType := c.Query("memory_type")
	minPrice := c.Query("min_price")
	maxPrice := c.Query("max_price")
	limit := c.DefaultQuery("limit", "20")
	offset := c.DefaultQuery("offset", "0")

	query := `
		SELECT id, seller_id, memory_type, price, status, created_at
		FROM memory_exchanges
		WHERE status = 'available'
	`

	var args []interface{}

	if memoryType != "" {
		query += " AND memory_type = ?"
		args = append(args, memoryType)
	}

	if minPrice != "" {
		query += " AND price >= ?"
		args = append(args, minPrice)
	}

	if maxPrice != "" {
		query += " AND price <= ?"
		args = append(args, maxPrice)
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error: " + err.Error()),
		})
		return
	}
	defer rows.Close()

	var memories []models.MemoryExchange
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
			"count":    len(memories),
		},
	})
}

// GetMyHistory godoc
// @Summary Get user's transaction history
// @Description Get all transactions (purchases and sales) for the authenticated user
// @Tags memory
// @Accept json
// @Produce json
// @Param limit query int false "Number of results to return" default(20)
// @Param offset query int false "Offset for pagination" default(0)
// @Success 200 {object} models.APIResponse "Transaction history"
// @Failure 401 {object} models.APIResponse "Unauthorized"
// @Failure 500 {object} models.APIResponse "Internal server error"
// @Security ApiKeyAuth
// @Router /memory/my-history [get]
func GetMyHistory(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   stringPtr("User not authenticated"),
		})
		return
	}

	limit := c.DefaultQuery("limit", "20")
	offset := c.DefaultQuery("offset", "0")

	query := `
		SELECT id, seller_id, buyer_id, memory_type, price, status, created_at
		FROM memory_exchanges
		WHERE seller_id = ? OR buyer_id = ?
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`

	rows, err := database.DB.Query(query, userID, userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error: " + err.Error()),
		})
		return
	}
	defer rows.Close()

	var transactions []models.MemoryExchange
	for rows.Next() {
		var tx models.MemoryExchange
		err := rows.Scan(
			&tx.ID,
			&tx.SellerID,
			&tx.BuyerID,
			&tx.MemoryType,
			&tx.Price,
			&tx.Status,
			&tx.CreatedAt,
		)
		if err != nil {
			continue
		}
		transactions = append(transactions, tx)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"transactions": transactions,
			"count":        len(transactions),
		},
	})
}

// PublishReasoningChain godoc
// @Summary Publish a reasoning chain
// @Description Publish a reasoning chain (sequence of thoughts) for trading
// @Tags reasoning-chain
// @Accept json
// @Produce json
// @Param request body models.PublishReasoningChainRequest true "Reasoning chain details"
// @Success 200 {object} models.APIResponse "Reasoning chain published successfully"
// @Failure 400 {object} models.APIResponse "Invalid request"
// @Failure 401 {object} models.APIResponse "Unauthorized"
// @Failure 500 {object} models.APIResponse "Internal server error"
// @Security ApiKeyAuth
// @Router /reasoning-chain/publish [post]
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

	// Serialize chain data
	chainDataJSON, err := json.Marshal(req.KVCacheSnapshot)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Failed to serialize chain data"),
		})
		return
	}

	// Insert into database
	query := `
		INSERT INTO reasoning_chains (
			creator_id, chain_type, chain_data, price, status, created_at
		) VALUES (?, ?, ?, ?, 'available', NOW())
	`

	result, err := database.DB.Exec(query, userID, req.Category, string(chainDataJSON), req.PricePerUse)
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

// UseReasoningChain godoc
// @Summary Use a reasoning chain
// @Description Access and use a reasoning chain (requires purchase or ownership)
// @Tags reasoning-chain
// @Accept json
// @Produce json
// @Param request body models.UseReasoningChainRequest true "Chain usage details"
// @Success 200 {object} models.APIResponse "Reasoning chain data"
// @Failure 400 {object} models.APIResponse "Invalid request"
// @Failure 401 {object} models.APIResponse "Unauthorized"
// @Failure 403 {object} models.APIResponse "Access denied"
// @Failure 404 {object} models.APIResponse "Chain not found"
// @Failure 500 {object} models.APIResponse "Internal server error"
// @Security ApiKeyAuth
// @Router /reasoning-chain/use [post]
func UseReasoningChain(c *gin.Context) {
	userID, exists := c.Get("user_id")
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

	// Check if chain exists and user has access
	var chain models.ReasoningChain
	query := `
		SELECT id, creator_id, category, kv_cache_snapshot, price_per_use, status
		FROM reasoning_chains
		WHERE id = ?
	`

	var kvCacheSnapshot sql.NullString
	err := database.DB.QueryRow(query, req.ChainID).Scan(
		&chain.ID,
		&chain.CreatorID,
		&chain.Category,
		&kvCacheSnapshot,
		&chain.PricePerUse,
		&chain.Status,
	)

	if kvCacheSnapshot.Valid {
		chain.KVCacheSnapshot = &kvCacheSnapshot.String
	}

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error:   stringPtr("Reasoning chain not found"),
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error: " + err.Error()),
		})
		return
	}

	// Check access (owner or purchased)
	userIDInt, _ := userID.(int)
	if chain.CreatorID != userIDInt {
		// TODO: Check if user has purchased access
		c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false,
			Error:   stringPtr("Access denied: You must purchase this reasoning chain"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"chain": chain,
		},
	})
}

// BrowseReasoningChains godoc
// @Summary Browse reasoning chains
// @Description Get a list of available reasoning chains with optional filtering
// @Tags reasoning-chain
// @Accept json
// @Produce json
// @Param chain_type query string false "Filter by chain type"
// @Param min_price query number false "Minimum price filter"
// @Param max_price query number false "Maximum price filter"
// @Param limit query int false "Number of results to return" default(20)
// @Param offset query int false "Offset for pagination" default(0)
// @Success 200 {object} models.APIResponse "List of reasoning chains"
// @Failure 500 {object} models.APIResponse "Internal server error"
// @Security ApiKeyAuth
// @Router /reasoning-chain/browse [get]
func BrowseReasoningChains(c *gin.Context) {
	chainType := c.Query("chain_type")
	minPrice := c.Query("min_price")
	maxPrice := c.Query("max_price")
	limit := c.DefaultQuery("limit", "20")
	offset := c.DefaultQuery("offset", "0")

	query := `
		SELECT id, creator_id, category, price_per_use, status, created_at
		FROM reasoning_chains
		WHERE status = 'active'
	`

	var args []interface{}

	if chainType != "" {
		query += " AND category = ?"
		args = append(args, chainType)
	}

	if minPrice != "" {
		query += " AND price >= ?"
		args = append(args, minPrice)
	}

	if maxPrice != "" {
		query += " AND price <= ?"
		args = append(args, maxPrice)
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   stringPtr("Database error: " + err.Error()),
		})
		return
	}
	defer rows.Close()

	var chains []models.ReasoningChain
	for rows.Next() {
		var chain models.ReasoningChain
		err := rows.Scan(
			&chain.ID,
			&chain.CreatorID,
			&chain.Category,
			&chain.PricePerUse,
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
			"count":  len(chains),
		},
	})
}

// GetStats godoc
// @Summary Get marketplace statistics
// @Description Get overall statistics for the memory exchange marketplace
// @Tags system
// @Accept json
// @Produce json
// @Success 200 {object} models.APIResponse "Marketplace statistics"
// @Failure 500 {object} models.APIResponse "Internal server error"
// @Security ApiKeyAuth
// @Router /stats [get]
func GetStats(c *gin.Context) {
	var stats struct {
		TotalMemories      int     `json:"total_memories"`
		AvailableMemories  int     `json:"available_memories"`
		TotalTransactions  int     `json:"total_transactions"`
		TotalReasoningChains int   `json:"total_reasoning_chains"`
		TotalVolume        float64 `json:"total_volume"`
	}

	// Count total memories
	database.DB.QueryRow("SELECT COUNT(*) FROM memory_exchanges").Scan(&stats.TotalMemories)

	// Count available memories
	database.DB.QueryRow("SELECT COUNT(*) FROM memory_exchanges WHERE status = 'available'").Scan(&stats.AvailableMemories)

	// Count completed transactions
	database.DB.QueryRow("SELECT COUNT(*) FROM memory_exchanges WHERE status = 'completed'").Scan(&stats.TotalTransactions)

	// Count reasoning chains
	database.DB.QueryRow("SELECT COUNT(*) FROM reasoning_chains").Scan(&stats.TotalReasoningChains)

	// Calculate total volume
	database.DB.QueryRow("SELECT COALESCE(SUM(price), 0) FROM memory_exchanges WHERE status = 'completed'").Scan(&stats.TotalVolume)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stats,
	})
}

// Helper function
func stringPtr(s string) *string {
	return &s
}
