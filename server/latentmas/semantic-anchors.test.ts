/**
 * Tests for Semantic Anchor Standardization
 */

import { describe, it, expect } from 'vitest';
import {
  generateGoldenAnchors,
  SemanticAnchorDB,
  createSemanticAnchorDB,
  SEMANTIC_CATEGORIES,
} from './semantic-anchors';

describe('Semantic Anchors', () => {
  describe('Golden Anchor Generation', () => {
    it('should generate exactly 1024 anchors', () => {
      const anchors = generateGoldenAnchors();
      expect(anchors.length).toBe(1024);
    });

    it('should have unique IDs', () => {
      const anchors = generateGoldenAnchors();
      const ids = anchors.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1024);
    });

    it('should cover all semantic categories', () => {
      const anchors = generateGoldenAnchors();
      const categories = new Set(anchors.map((a) => a.category));

      for (const category of SEMANTIC_CATEGORIES) {
        expect(categories.has(category)).toBe(true);
      }
    });

    it('should have valid prompts', () => {
      const anchors = generateGoldenAnchors();

      for (const anchor of anchors) {
        expect(anchor.prompt).toBeTruthy();
        expect(anchor.prompt.length).toBeGreaterThan(0);
      }
    });

    it('should have expected dimensions', () => {
      const anchors = generateGoldenAnchors();

      for (const anchor of anchors) {
        expect(anchor.expectedDimensions).toBeTruthy();
        expect(anchor.expectedDimensions.length).toBeGreaterThan(0);
      }
    });

    it('should have valid weights', () => {
      const anchors = generateGoldenAnchors();

      for (const anchor of anchors) {
        expect(anchor.weight).toBeGreaterThan(0);
        expect(anchor.weight).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Semantic Anchor Database', () => {
    it('should initialize with 1024 anchors', () => {
      const db = createSemanticAnchorDB();
      const anchors = db.getAllAnchors();
      expect(anchors.length).toBe(1024);
    });

    it('should get anchors by category', () => {
      const db = createSemanticAnchorDB();
      const category = 'factual_knowledge';
      const anchors = db.getAnchorsByCategory(category);

      expect(anchors.length).toBeGreaterThan(0);
      anchors.forEach((a) => {
        expect(a.category).toBe(category);
      });
    });

    it('should get anchor by ID', () => {
      const db = createSemanticAnchorDB();
      const anchor = db.getAnchor(0);

      expect(anchor).toBeDefined();
      expect(anchor?.id).toBe(0);
    });

    it('should store and retrieve anchor vectors', () => {
      const db = createSemanticAnchorDB();
      const vector = [1, 2, 3, 4, 5];

      db.storeAnchorVector(0, vector);
      const retrieved = db.getAnchorVector(0);

      expect(retrieved).toEqual(vector);
    });

    it('should find nearest anchors', () => {
      const db = createSemanticAnchorDB();

      // Store some anchor vectors
      for (let i = 0; i < 10; i++) {
        const vector = Array.from({ length: 128 }, () => Math.random());
        db.storeAnchorVector(i, vector);
      }

      // Query with a test vector
      const queryVector = Array.from({ length: 128 }, () => Math.random());
      const nearest = db.findNearestAnchors(queryVector, 5);

      expect(nearest.length).toBeLessThanOrEqual(5);
      expect(nearest.length).toBeGreaterThan(0);

      // Check that results are sorted by similarity
      for (let i = 1; i < nearest.length; i++) {
        expect(nearest[i].similarity).toBeLessThanOrEqual(
          nearest[i - 1].similarity
        );
      }
    });

    it('should calculate calibration', () => {
      const db = createSemanticAnchorDB();

      // Store anchor vectors from different categories
      const categories = SEMANTIC_CATEGORIES.slice(0, 5);
      categories.forEach((category, catIndex) => {
        const anchors = db.getAnchorsByCategory(category);
        anchors.slice(0, 2).forEach((anchor) => {
          const vector = Array.from(
            { length: 128 },
            () => Math.random() + catIndex * 0.1
          );
          db.storeAnchorVector(anchor.id, vector);
        });
      });

      // Calibrate a test vector
      const testVector = Array.from({ length: 128 }, () => Math.random());
      const calibration = db.calibrateAlignment(testVector);

      expect(calibration.calibrationScore).toBeGreaterThanOrEqual(0);
      expect(calibration.calibrationScore).toBeLessThanOrEqual(1);
      expect(calibration.coverage).toBeGreaterThanOrEqual(0);
      expect(calibration.coverage).toBeLessThanOrEqual(1);
      expect(calibration.anchors.length).toBeGreaterThan(0);
      expect(calibration.recommendations).toBeDefined();
    });

    it('should provide statistics', () => {
      const db = createSemanticAnchorDB();
      const stats = db.getStatistics();

      expect(stats.totalAnchors).toBe(1024);
      expect(Object.keys(stats.categoryCounts).length).toBeGreaterThan(0);
      expect(stats.vectorsCached).toBe(0); // No vectors cached yet

      // Store a vector
      db.storeAnchorVector(0, [1, 2, 3]);
      const updatedStats = db.getStatistics();
      expect(updatedStats.vectorsCached).toBe(1);
    });
  });

  describe('Integration Test', () => {
    it('should perform full anchor-based calibration', () => {
      const db = createSemanticAnchorDB();

      // Simulate storing vectors for all anchors (sample)
      const sampleSize = 100;
      const allAnchors = db.getAllAnchors();

      for (let i = 0; i < sampleSize; i++) {
        const anchor = allAnchors[i];
        // Generate vector with category-specific characteristics
        const categoryIndex = SEMANTIC_CATEGORIES.indexOf(
          anchor.category as any
        );
        const vector = Array.from(
          { length: 128 },
          () => Math.random() + categoryIndex * 0.05
        );
        db.storeAnchorVector(anchor.id, vector);
      }

      // Test vector similar to factual_knowledge category
      const testVector = Array.from({ length: 128 }, () => Math.random());

      // Find nearest anchors
      const nearest = db.findNearestAnchors(testVector, 10);
      expect(nearest.length).toBe(10);

      // Calibrate alignment
      const calibration = db.calibrateAlignment(testVector);

      console.log(`✓ Semantic anchor calibration test passed:`);
      console.log(`  - Total anchors: ${db.getStatistics().totalAnchors}`);
      console.log(`  - Vectors cached: ${db.getStatistics().vectorsCached}`);
      console.log(`  - Nearest anchors found: ${nearest.length}`);
      console.log(
        `  - Top match: ${nearest[0].category} (similarity: ${nearest[0].similarity.toFixed(4)})`
      );
      console.log(
        `  - Calibration score: ${(calibration.calibrationScore * 100).toFixed(2)}%`
      );
      console.log(
        `  - Semantic coverage: ${(calibration.coverage * 100).toFixed(2)}%`
      );
      console.log(`  - Recommendations: ${calibration.recommendations.length}`);

      expect(calibration.calibrationScore).toBeGreaterThan(0);
      expect(calibration.coverage).toBeGreaterThan(0);
      expect(nearest[0].similarity).toBeGreaterThan(0);
    });

    it('should handle diverse category distribution', () => {
      const db = createSemanticAnchorDB();
      const stats = db.getStatistics();

      // Check that each category has anchors
      for (const category of SEMANTIC_CATEGORIES) {
        expect(stats.categoryCounts[category]).toBeGreaterThan(0);
      }

      // Check that distribution is relatively balanced
      const counts = Object.values(stats.categoryCounts);
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
      const maxDeviation = Math.max(...counts.map((c) => Math.abs(c - avgCount)));

      // Max deviation should be less than 50% of average
      expect(maxDeviation).toBeLessThan(avgCount * 0.5);
    });
  });
});
