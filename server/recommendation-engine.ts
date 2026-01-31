/**
 * AI-Powered Recommendation Engine
 *
 * Uses LLM to analyze user browsing history, preferences, and vector metadata
 * to provide personalized recommendations for AI capabilities.
 */

import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { createLogger } from './utils/logger';

const logger = createLogger('Recommendation');

// Vector type for recommendations
interface VectorInfo {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  basePrice: string;
  averageRating: string | null;
  totalCalls: number;
  status: string;
}

// Transaction with optional nested transactions
interface TransactionData {
  vectorId?: number;
  transactions?: { vectorId: number };
}

// Viewed vector summary
interface ViewedVectorSummary {
  title: string;
  category: string | null;
  description?: string;
}

export interface RecommendationContext {
  userId: number;
  limit?: number;
}

export interface Recommendation {
  vectorId: number;
  score: number;
  reason: string;
  vector?: VectorInfo;
}

/**
 * Generate personalized recommendations for a user
 */
export async function generateRecommendations(
  context: RecommendationContext
): Promise<Recommendation[]> {
  const { userId, limit = 5 } = context;

  // 1. Fetch user's browsing history (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const browsingHistory = await db.getBrowsingHistory(userId, thirtyDaysAgo);
  
  // 2. Fetch user preferences
  const preferences = await db.getUserPreferences(userId);
  
  // 3. Fetch user's past purchases
  const purchases = await db.getUserTransactions(userId, "buyer");
  
  // 4. Get all active vectors
  const allVectors = await db.searchLatentVectors({
    status: "active",
    limit: 100,
  });

  // 5. Build context for LLM
  const viewedVectors = browsingHistory
    .filter(h => h.action === "view")
    .map(h => {
      const vector = allVectors.find(v => v.id === h.vectorId);
      return vector ? {
        title: vector.title,
        category: vector.category,
        description: vector.description?.substring(0, 200),
      } : null;
    })
    .filter(Boolean);

  const purchasedVectors = purchases
    .map((p: TransactionData) => {
      const txData = p.transactions || p;
      const vector = allVectors.find(v => v.id === txData.vectorId);
      return vector ? {
        title: vector.title,
        category: vector.category,
      } : null;
    })
    .filter(Boolean);

  const preferredCategories = preferences?.preferredCategories 
    ? JSON.parse(preferences.preferredCategories) 
    : [];

  // 6. Use LLM to analyze and recommend
  const prompt = `You are an AI recommendation engine for a marketplace of AI capabilities (latent space vectors).

**User Profile:**
- Preferred Categories: ${preferredCategories.length > 0 ? preferredCategories.join(", ") : "None specified"}
- Recently Viewed: ${viewedVectors.length} vectors
- Past Purchases: ${purchasedVectors.length} vectors

**Recently Viewed Vectors:**
${viewedVectors.slice(0, 5).map((v, i: number) => `${i + 1}. ${(v as ViewedVectorSummary).title} (${(v as ViewedVectorSummary).category}): ${(v as ViewedVectorSummary).description}`).join("\n")}

**Past Purchases:**
${purchasedVectors.slice(0, 3).map((v, i: number) => `${i + 1}. ${(v as ViewedVectorSummary).title} (${(v as ViewedVectorSummary).category})`).join("\n")}

**Available Vectors to Recommend:**
${allVectors.slice(0, 20).map((v, i) => `${i + 1}. ID: ${v.id}, Title: ${v.title}, Category: ${v.category}, Price: $${v.basePrice}, Rating: ${v.averageRating || "N/A"}, Description: ${v.description?.substring(0, 150)}`).join("\n")}

Based on the user's browsing history and preferences, recommend the top ${limit} vectors that would be most relevant and valuable to them.

For each recommendation, provide:
1. Vector ID
2. Relevance score (0-100)
3. A brief reason why this vector is recommended (1-2 sentences)

Respond in JSON format:
{
  "recommendations": [
    {
      "vectorId": 123,
      "score": 95,
      "reason": "This vector aligns with your interest in financial analysis and has excellent performance metrics."
    }
  ]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert AI recommendation system. Analyze user behavior and provide personalized, relevant recommendations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recommendations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    vectorId: { type: "number" },
                    score: { type: "number" },
                    reason: { type: "string" },
                  },
                  required: ["vectorId", "score", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const message = response.choices[0]?.message;
    const content = typeof message?.content === 'string' ? message.content : null;
    if (!content) {
      logger.error("[Recommendations] Empty response from LLM");
      return fallbackRecommendations(allVectors, limit);
    }

    const parsed = JSON.parse(content);
    const recommendations: Recommendation[] = parsed.recommendations || [];

    // Enrich with vector data
    const enriched = recommendations.map(rec => {
      const vector = allVectors.find(v => v.id === rec.vectorId);
      return {
        ...rec,
        vector,
      };
    }).filter(rec => rec.vector); // Only include valid vectors

    return enriched.slice(0, limit);
  } catch (error) {
    logger.error("[Recommendations] LLM error:", { error });
    return fallbackRecommendations(allVectors, limit);
  }
}

/**
 * Fallback recommendations based on simple heuristics
 */
function fallbackRecommendations(vectors: VectorInfo[], limit: number): Recommendation[] {
  // Sort by rating and popularity
  const sorted = [...vectors]
    .filter(v => v.status === "active")
    .sort((a, b) => {
      const scoreA = (parseFloat(a.averageRating || "0") * 0.7) + (a.totalCalls * 0.3 / 1000);
      const scoreB = (parseFloat(b.averageRating || "0") * 0.7) + (b.totalCalls * 0.3 / 1000);
      return scoreB - scoreA;
    })
    .slice(0, limit);

  return sorted.map(v => ({
    vectorId: v.id,
    score: parseFloat(v.averageRating || "0") * 20, // Convert 5-star to 100-point scale
    reason: "Popular choice with high ratings and proven performance.",
    vector: v,
  }));
}

/**
 * Track user browsing action
 */
export async function trackBrowsingAction(
  userId: number,
  vectorId: number,
  action: "view" | "click" | "search",
  metadata?: Record<string, any>
): Promise<void> {
  await db.insertBrowsingHistory({
    userId,
    vectorId,
    action,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}
