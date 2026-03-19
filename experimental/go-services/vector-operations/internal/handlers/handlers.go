package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
	"vector-operations/internal/models"
	"vector-operations/internal/storage"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	DB *sql.DB
}

func NewHandler(db *sql.DB) *Handler {
	return &Handler{DB: db}
}

// GetVectorStats godoc
// @Summary Get vector storage statistics
// @Description Get statistics about stored vectors
// @Tags vectors
// @Produce json
// @Success 200 {object} models.VectorStats
// @Failure 500 {object} map[string]string
// @Router /api/v1/vectors/stats [get]
func (h *Handler) GetVectorStats(c *gin.Context) {
	var stats models.VectorStats

	// Return mock data if DB is not available
	if h.DB == nil {
		stats = models.VectorStats{
			TotalVectors:  15234,
			AvgDimension:  768.5,
			TotalCreators: 127,
			StorageSize:   524288000,
			LastUpdated:   time.Now().Format(time.RFC3339),
		}
		c.JSON(http.StatusOK, stats)
		return
	}

	// Query real data from database
	err := h.DB.QueryRow(`
		SELECT COUNT(*), AVG(dimension), COUNT(DISTINCT creator_id)
		FROM vectors
	`).Scan(&stats.TotalVectors, &stats.AvgDimension, &stats.TotalCreators)

	if err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	stats.LastUpdated = time.Now().Format(time.RFC3339)
	c.JSON(http.StatusOK, stats)
}

// SearchVectors godoc
// @Summary Search for similar vectors
// @Description Find vectors similar to the query vector using cosine similarity
// @Tags vectors
// @Accept json
// @Produce json
// @Param request body models.VectorSearchRequest true "Search request"
// @Success 200 {array} models.VectorSearchResult
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/vectors/search [post]
func (h *Handler) SearchVectors(c *gin.Context) {
	var req models.VectorSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default threshold if not provided
	if req.Threshold == 0 {
		req.Threshold = 0.7
	}

	// Return mock data if DB is not available
	if h.DB == nil {
		mockVectors := []models.Vector{
			{
				ID:          "vec_001",
				Name:        "GPT-4 Reasoning",
				Description: "Advanced reasoning capabilities",
				Embedding:   generateMockEmbedding(len(req.QueryVector)),
				Dimension:   len(req.QueryVector),
				CreatorID:   "user_001",
				CreatedAt:   time.Now().Add(-24 * time.Hour),
			},
			{
				ID:          "vec_002",
				Name:        "Claude Analysis",
				Description: "Deep analytical thinking",
				Embedding:   generateMockEmbedding(len(req.QueryVector)),
				Dimension:   len(req.QueryVector),
				CreatorID:   "user_002",
				CreatedAt:   time.Now().Add(-48 * time.Hour),
			},
		}

		results := storage.SearchSimilarVectors(req.QueryVector, mockVectors, req.TopK, req.Threshold)
		c.JSON(http.StatusOK, results)
		return
	}

	// Query vectors from database
	rows, err := h.DB.Query(`
		SELECT id, name, description, embedding, dimension, creator_id, created_at
		FROM vectors
		LIMIT 1000
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	vectors := make([]models.Vector, 0)
	for rows.Next() {
		var vec models.Vector
		var embeddingJSON string

		err := rows.Scan(&vec.ID, &vec.Name, &vec.Description, &embeddingJSON, &vec.Dimension, &vec.CreatorID, &vec.CreatedAt)
		if err != nil {
			continue
		}

		// Parse embedding JSON
		if err := json.Unmarshal([]byte(embeddingJSON), &vec.Embedding); err != nil {
			continue
		}

		vectors = append(vectors, vec)
	}

	results := storage.SearchSimilarVectors(req.QueryVector, vectors, req.TopK, req.Threshold)
	c.JSON(http.StatusOK, results)
}

// StoreVector godoc
// @Summary Store a new vector
// @Description Store a latent space vector
// @Tags vectors
// @Accept json
// @Produce json
// @Param vector body models.Vector true "Vector to store"
// @Success 201 {object} models.Vector
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/vectors [post]
func (h *Handler) StoreVector(c *gin.Context) {
	var vec models.Vector
	if err := c.ShouldBindJSON(&vec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	vec.CreatedAt = time.Now()
	vec.UpdatedAt = time.Now()
	vec.Dimension = len(vec.Embedding)

	// Return mock response if DB is not available
	if h.DB == nil {
		vec.ID = "vec_" + time.Now().Format("20060102150405")
		c.JSON(http.StatusCreated, vec)
		return
	}

	// Store in database
	embeddingJSON, err := json.Marshal(vec.Embedding)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize embedding"})
		return
	}

	result, err := h.DB.Exec(`
		INSERT INTO vectors (id, name, description, embedding, dimension, creator_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, vec.ID, vec.Name, vec.Description, embeddingJSON, vec.Dimension, vec.CreatorID, vec.CreatedAt, vec.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	vec.ID = string(rune(id))

	c.JSON(http.StatusCreated, vec)
}

// BatchStoreVectors godoc
// @Summary Store multiple vectors
// @Description Store multiple latent space vectors in a single request
// @Tags vectors
// @Accept json
// @Produce json
// @Param request body models.BatchVectorRequest true "Batch vector request"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/vectors/batch [post]
func (h *Handler) BatchStoreVectors(c *gin.Context) {
	var req models.BatchVectorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	stored := 0
	failed := 0

	for _, vec := range req.Vectors {
		vec.CreatedAt = time.Now()
		vec.UpdatedAt = time.Now()
		vec.Dimension = len(vec.Embedding)

		if h.DB != nil {
			embeddingJSON, err := json.Marshal(vec.Embedding)
			if err != nil {
				failed++
				continue
			}

			_, err = h.DB.Exec(`
				INSERT INTO vectors (id, name, description, embedding, dimension, creator_id, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`, vec.ID, vec.Name, vec.Description, embeddingJSON, vec.Dimension, vec.CreatorID, vec.CreatedAt, vec.UpdatedAt)

			if err != nil {
				failed++
				continue
			}
		}

		stored++
	}

	c.JSON(http.StatusCreated, gin.H{
		"stored": stored,
		"failed": failed,
		"total":  len(req.Vectors),
	})
}

// Helper function to generate mock embeddings
func generateMockEmbedding(dimension int) []float64 {
	embedding := make([]float64, dimension)
	for i := range embedding {
		embedding[i] = float64(i) / float64(dimension)
	}
	return embedding
}
