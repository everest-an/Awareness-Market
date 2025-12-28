/**
 * Seed Data Script for Awareness Network
 * Creates sample vectors, users, transactions, and reviews
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import crypto from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function main() {
  console.log("🌱 Starting data seeding...\n");

  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  try {
    // Create sample users
    console.log("Creating sample users...");
    const users = [];
    
    // AI Agent users
    for (let i = 1; i <= 5; i++) {
      const result = await connection.execute(
        `INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        [
          `ai_agent_${crypto.randomBytes(8).toString("hex")}`,
          `AI Agent ${i}`,
          `agent${i}@awareness-network.com`,
          "api",
          i <= 2 ? "creator" : "consumer"
        ]
      );
      users.push({ id: Number(result[0].insertId), role: i <= 2 ? "creator" : "consumer" });
    }
    
    // Human users
    for (let i = 1; i <= 3; i++) {
      const result = await connection.execute(
        `INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        [
          `human_${crypto.randomBytes(8).toString("hex")}`,
          `Human User ${i}`,
          `user${i}@example.com`,
          "manus",
          i === 1 ? "creator" : "consumer"
        ]
      );
      users.push({ id: Number(result[0].insertId), role: i === 1 ? "creator" : "consumer" });
    }
    
    console.log(`✓ Created ${users.length} users\n`);

    // Create sample latent vectors
    console.log("Creating sample latent vectors...");
    const vectors = [];
    const categories = ["text-generation", "code-generation", "image-analysis", "data-processing", "reasoning"];
    const vectorData = [
      {
        name: "GPT-4 Text Understanding",
        description: "Advanced natural language understanding capability extracted from GPT-4. Excellent for semantic analysis, question answering, and context comprehension.",
        category: "text-generation",
        price: 49.99,
        dimension: 1536,
        performanceMetrics: JSON.stringify({ accuracy: 0.95, latency: 120, throughput: 1000 })
      },
      {
        name: "Claude Code Optimizer",
        description: "Code optimization and refactoring capability from Claude. Specializes in improving code quality, performance, and maintainability.",
        category: "code-generation",
        price: 79.99,
        dimension: 2048,
        performanceMetrics: JSON.stringify({ accuracy: 0.92, latency: 150, throughput: 800 })
      },
      {
        name: "Vision Transformer Embeddings",
        description: "State-of-the-art image understanding from ViT models. Perfect for image classification, object detection, and visual reasoning.",
        category: "image-analysis",
        price: 99.99,
        dimension: 768,
        performanceMetrics: JSON.stringify({ accuracy: 0.94, latency: 80, throughput: 1200 })
      },
      {
        name: "LLaMA Reasoning Engine",
        description: "Powerful logical reasoning and problem-solving capability from LLaMA. Ideal for complex decision-making and analytical tasks.",
        category: "reasoning",
        price: 129.99,
        dimension: 4096,
        performanceMetrics: JSON.stringify({ accuracy: 0.91, latency: 200, throughput: 600 })
      },
      {
        name: "Pandas Data Processor",
        description: "Efficient data manipulation and analysis capability. Handles large datasets with optimized vectorized operations.",
        category: "data-processing",
        price: 39.99,
        dimension: 512,
        performanceMetrics: JSON.stringify({ accuracy: 0.98, latency: 50, throughput: 2000 })
      },
      {
        name: "BERT Semantic Search",
        description: "High-quality semantic search and similarity matching from BERT. Excellent for information retrieval and document ranking.",
        category: "text-generation",
        price: 59.99,
        dimension: 768,
        performanceMetrics: JSON.stringify({ accuracy: 0.93, latency: 100, throughput: 1500 })
      },
      {
        name: "Stable Diffusion Style Transfer",
        description: "Creative style transfer capability from Stable Diffusion. Transform images with artistic styles while preserving content.",
        category: "image-analysis",
        price: 89.99,
        dimension: 1024,
        performanceMetrics: JSON.stringify({ accuracy: 0.90, latency: 300, throughput: 400 })
      },
      {
        name: "CodeLlama Function Generator",
        description: "Specialized function generation from CodeLlama. Creates production-ready code with proper error handling and documentation.",
        category: "code-generation",
        price: 69.99,
        dimension: 2048,
        performanceMetrics: JSON.stringify({ accuracy: 0.89, latency: 180, throughput: 700 })
      }
    ];

    const creators = users.filter(u => u.role === "creator");
    
    for (const vectorInfo of vectorData) {
      const creator = creators[Math.floor(Math.random() * creators.length)];
      const result = await connection.execute(
        `INSERT INTO latent_vectors (
          creatorId, name, description, category, price, dimension, 
          vectorData, performanceMetrics, status, totalCalls, 
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          creator.id,
          vectorInfo.name,
          vectorInfo.description,
          vectorInfo.category,
          vectorInfo.price,
          vectorInfo.dimension,
          `s3://awareness-network/vectors/${crypto.randomBytes(16).toString("hex")}.bin`,
          vectorInfo.performanceMetrics,
          "active",
          Math.floor(Math.random() * 1000) + 100
        ]
      );
      vectors.push({ id: Number(result[0].insertId), creatorId: creator.id, price: vectorInfo.price });
    }
    
    console.log(`✓ Created ${vectors.length} latent vectors\n`);

    // Create sample transactions
    console.log("Creating sample transactions...");
    const consumers = users.filter(u => u.role === "consumer");
    const transactions = [];
    
    for (let i = 0; i < 15; i++) {
      const vector = vectors[Math.floor(Math.random() * vectors.length)];
      const consumer = consumers[Math.floor(Math.random() * consumers.length)];
      const transactionFee = vector.price * 0.20; // 20% platform fee
      
      const result = await connection.execute(
        `INSERT INTO transactions (
          buyerId, vectorId, amount, transactionFee, paymentMethod, 
          paymentStatus, stripePaymentIntentId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          consumer.id,
          vector.id,
          vector.price,
          transactionFee,
          "stripe",
          "completed",
          `pi_${crypto.randomBytes(12).toString("hex")}`
        ]
      );
      transactions.push({ id: Number(result[0].insertId), vectorId: vector.id, buyerId: consumer.id });
      
      // Grant access permission
      await connection.execute(
        `INSERT INTO access_permissions (
          userId, vectorId, accessType, grantedAt, expiresAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), NOW(), NOW())`,
        [consumer.id, vector.id, "full"]
      );
    }
    
    console.log(`✓ Created ${transactions.length} transactions\n`);

    // Create sample reviews
    console.log("Creating sample reviews...");
    const reviewTexts = [
      "Excellent capability! Significantly improved our AI system's performance.",
      "Great quality vector. Easy to integrate and delivers consistent results.",
      "Good value for money. The performance metrics are accurate.",
      "Outstanding! This vector exceeded our expectations in production.",
      "Solid performance. Would recommend for similar use cases.",
      "Very impressed with the quality. Worth every penny.",
      "Reliable and efficient. Our team is very satisfied.",
      "Perfect for our needs. Integration was seamless."
    ];
    
    for (const transaction of transactions) {
      if (Math.random() > 0.3) { // 70% chance of review
        const rating = Math.floor(Math.random() * 2) + 4; // 4-5 stars
        const reviewText = reviewTexts[Math.floor(Math.random() * reviewTexts.length)];
        
        await connection.execute(
          `INSERT INTO reviews (
            vectorId, userId, rating, comment, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [transaction.vectorId, transaction.buyerId, rating, reviewText]
        );
      }
    }
    
    console.log(`✓ Created sample reviews\n`);

    // Update vector average ratings
    console.log("Calculating average ratings...");
    await connection.execute(`
      UPDATE latent_vectors lv
      SET averageRating = (
        SELECT AVG(rating)
        FROM reviews r
        WHERE r.vectorId = lv.id
      )
      WHERE id IN (SELECT DISTINCT vectorId FROM reviews)
    `);
    
    console.log(`✓ Updated average ratings\n`);

    // Create sample API call logs
    console.log("Creating API call logs...");
    for (let i = 0; i < 50; i++) {
      const transaction = transactions[Math.floor(Math.random() * transactions.length)];
      const responseTime = Math.floor(Math.random() * 300) + 50;
      
      await connection.execute(
        `INSERT INTO api_call_logs (
          userId, vectorId, endpoint, responseTime, statusCode, createdAt
        ) VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [
          transaction.buyerId,
          transaction.vectorId,
          "/api/mcp/invoke",
          responseTime,
          200,
          Math.floor(Math.random() * 30)
        ]
      );
    }
    
    console.log(`✓ Created 50 API call logs\n`);

    console.log("✅ Data seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - ${users.length} users (${creators.length} creators, ${consumers.length} consumers)`);
    console.log(`   - ${vectors.length} latent vectors`);
    console.log(`   - ${transactions.length} transactions`);
    console.log(`   - ~${Math.floor(transactions.length * 0.7)} reviews`);
    console.log(`   - 50 API call logs`);
    
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
