package storage

import (
	"math"
	"vector-operations/internal/models"
)

// CosineSimilarity calculates cosine similarity between two vectors
func CosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0
	}

	var dotProduct, normA, normB float64
	for i := range a {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// EuclideanDistance calculates Euclidean distance between two vectors
func EuclideanDistance(a, b []float64) float64 {
	if len(a) != len(b) {
		return math.MaxFloat64
	}

	var sum float64
	for i := range a {
		diff := a[i] - b[i]
		sum += diff * diff
	}

	return math.Sqrt(sum)
}

// SearchSimilarVectors finds the top-k most similar vectors
func SearchSimilarVectors(query []float64, vectors []models.Vector, topK int, threshold float64) []models.VectorSearchResult {
	results := make([]models.VectorSearchResult, 0)

	for _, vec := range vectors {
		if len(vec.Embedding) != len(query) {
			continue
		}

		similarity := CosineSimilarity(query, vec.Embedding)
		distance := EuclideanDistance(query, vec.Embedding)

		if similarity >= threshold {
			results = append(results, models.VectorSearchResult{
				Vector:     vec,
				Similarity: similarity,
				Distance:   distance,
			})
		}
	}

	// Sort by similarity (descending)
	for i := 0; i < len(results)-1; i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Similarity > results[i].Similarity {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	// Return top-k results
	if len(results) > topK {
		results = results[:topK]
	}

	return results
}
