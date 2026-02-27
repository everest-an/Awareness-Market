/**
 * Code Search Engine — BM25 + Semantic + RRF hybrid search
 *
 * In-memory search engine for code knowledge graphs.
 * BM25 for keyword matching, cosine similarity for semantic search,
 * Reciprocal Rank Fusion (RRF) for combining results.
 */

import type { CodeGraph, CodeNode, SearchResult } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('SearchEngine');

// BM25 parameters
const K1 = 1.2;
const B = 0.75;

// RRF parameter (standard from literature)
const RRF_K = 60;

interface BM25Doc {
  nodeId: string;
  terms: Map<string, number>; // term → term frequency
  length: number;
}

export class CodeSearchEngine {
  private nodes: CodeNode[];
  private docs: BM25Doc[];
  private idf: Map<string, number>;
  private avgDocLength: number;
  private totalDocs: number;

  constructor(graph: CodeGraph) {
    this.nodes = graph.nodes;
    this.docs = [];
    this.idf = new Map();
    this.totalDocs = 0;
    this.avgDocLength = 0;

    this.buildBM25Index();
  }

  private buildBM25Index(): void {
    const dfMap = new Map<string, number>(); // document frequency

    for (const node of this.nodes) {
      const text = this.nodeToText(node);
      const terms = this.tokenize(text);
      const tf = new Map<string, number>();

      for (const term of terms) {
        tf.set(term, (tf.get(term) || 0) + 1);
      }

      this.docs.push({
        nodeId: node.id,
        terms: tf,
        length: terms.length,
      });

      // Count document frequency
      for (const term of new Set(terms)) {
        dfMap.set(term, (dfMap.get(term) || 0) + 1);
      }
    }

    this.totalDocs = this.docs.length;
    this.avgDocLength = this.totalDocs > 0
      ? this.docs.reduce((sum, d) => sum + d.length, 0) / this.totalDocs
      : 1;

    // Calculate IDF for each term
    for (const [term, df] of dfMap) {
      this.idf.set(term, Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1));
    }

    logger.info('BM25 index built', {
      docs: this.totalDocs,
      uniqueTerms: this.idf.size,
    });
  }

  private nodeToText(node: CodeNode): string {
    const parts = [
      node.label,
      node.type,
      node.filePath,
      node.directory,
      node.language,
    ];
    return parts.filter(Boolean).join(' ');
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      // Split on non-alphanumeric, camelCase, and path separators
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  /**
   * BM25 search — keyword matching
   */
  searchBM25(query: string, topK: number = 50): Array<{ nodeId: string; score: number }> {
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) return [];

    const scores: Array<{ nodeId: string; score: number }> = [];

    for (const doc of this.docs) {
      let score = 0;

      for (const term of queryTerms) {
        const tf = doc.terms.get(term) || 0;
        if (tf === 0) continue;

        const idf = this.idf.get(term) || 0;
        const numerator = tf * (K1 + 1);
        const denominator = tf + K1 * (1 - B + B * (doc.length / this.avgDocLength));
        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        scores.push({ nodeId: doc.nodeId, score });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Simple semantic search using term overlap + fuzzy matching
   * (lightweight alternative to embedding vectors)
   */
  searchSemantic(query: string, topK: number = 50): Array<{ nodeId: string; score: number }> {
    const queryTerms = new Set(this.tokenize(query));
    if (queryTerms.size === 0) return [];

    const scores: Array<{ nodeId: string; score: number }> = [];

    for (const doc of this.docs) {
      let matchCount = 0;
      let partialMatchCount = 0;

      for (const qTerm of queryTerms) {
        for (const [docTerm] of doc.terms) {
          if (docTerm === qTerm) {
            matchCount++;
          } else if (docTerm.includes(qTerm) || qTerm.includes(docTerm)) {
            partialMatchCount++;
          }
        }
      }

      const score = matchCount + partialMatchCount * 0.3;
      if (score > 0) {
        // Normalize by query size
        scores.push({
          nodeId: doc.nodeId,
          score: score / queryTerms.size,
        });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Hybrid search with Reciprocal Rank Fusion
   */
  async search(query: string, topK: number = 20): Promise<SearchResult[]> {
    const bm25Results = this.searchBM25(query, topK * 3);
    const semanticResults = this.searchSemantic(query, topK * 3);

    // Calculate RRF scores
    const rrfScores = new Map<string, { score: number; sources: Set<'bm25' | 'semantic'> }>();

    // BM25 RRF
    bm25Results.forEach((result, rank) => {
      const rrfScore = 1 / (RRF_K + rank);
      const existing = rrfScores.get(result.nodeId);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.add('bm25');
      } else {
        rrfScores.set(result.nodeId, { score: rrfScore, sources: new Set(['bm25']) });
      }
    });

    // Semantic RRF
    semanticResults.forEach((result, rank) => {
      const rrfScore = 1 / (RRF_K + rank);
      const existing = rrfScores.get(result.nodeId);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.add('semantic');
      } else {
        rrfScores.set(result.nodeId, { score: rrfScore, sources: new Set(['semantic']) });
      }
    });

    // Build results
    const results: SearchResult[] = [];
    for (const [nodeId, { score, sources }] of rrfScores) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      results.push({
        nodeId,
        label: node.label,
        filePath: node.filePath,
        type: node.type,
        score: Math.round(score * 1000) / 1000,
        sources: [...sources],
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
