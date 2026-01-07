import { getDb } from "../server/db";
import { vectorPackages, memoryPackages, chainPackages } from "../drizzle/schema";

/**
 * Generate 15 high-quality sample packages for the marketplace
 * - 5 Vector Packages
 * - 5 Memory Packages  
 * - 5 Chain Packages
 */

async function main() {
  console.log("🚀 Starting sample data generation...\n");

  const db = await getDb();

  try {
    // Insert Vector Packages
    console.log("📦 Inserting Vector Packages...");
    
    const vectorPkgs = [
      {
        packageId: `vp_${Date.now()}_1`,
        userId: 1,
        name: "GPT-4 → Claude-3.5 Sentiment Analysis",
        description: "High-quality sentiment analysis capability trained on 50K+ examples. Achieves 94% accuracy on financial news sentiment classification.",
        vectorUrl: "https://example.com/vectors/sentiment-gpt4-claude35.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/sentiment-gpt4-claude35-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/sentiment-gpt4-claude35.vectorpkg",
        sourceModel: "gpt-4",
        targetModel: "claude-3-sonnet",
        dimension: 4096,
        epsilon: 0.038,
        informationRetention: 0.96,
        category: "nlp" as const,
        price: 49.99,
        downloads: 234,
        rating: 4.8,
      },
      {
        packageId: `vp_${Date.now()}_2`,
        userId: 1,
        name: "LLaMA-3 → GPT-4 Code Generation",
        description: "Python code generation specialist fine-tuned on 100K+ code snippets. Supports function generation, bug fixing, and code explanation.",
        vectorUrl: "https://example.com/vectors/code-llama3-gpt4.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/code-llama3-gpt4-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/code-llama3-gpt4.vectorpkg",
        sourceModel: "llama-3-70b",
        targetModel: "gpt-4",
        dimension: 8192,
        epsilon: 0.042,
        informationRetention: 0.94,
        category: "nlp" as const,
        price: 79.99,
        downloads: 456,
        rating: 4.9,
      },
      {
        packageId: `vp_${Date.now()}_3`,
        userId: 1,
        name: "CLIP → DALL-E 3 Image Understanding",
        description: "Advanced image understanding vector trained on 1M+ image-text pairs. Excels at scene description and visual question answering.",
        vectorUrl: "https://example.com/vectors/image-clip-dalle3.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/image-clip-dalle3-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/image-clip-dalle3.vectorpkg",
        sourceModel: "clip-vit-l-14",
        targetModel: "dall-e-3",
        dimension: 768,
        epsilon: 0.029,
        informationRetention: 0.98,
        category: "vision" as const,
        price: 99.99,
        downloads: 189,
        rating: 4.7,
      },
      {
        packageId: `vp_${Date.now()}_4`,
        userId: 1,
        name: "Whisper → GPT-4 Audio Transcription",
        description: "Multi-language audio transcription specialist supporting 50+ languages. Includes speaker diarization and punctuation restoration.",
        vectorUrl: "https://example.com/vectors/audio-whisper-gpt4.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/audio-whisper-gpt4-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/audio-whisper-gpt4.vectorpkg",
        sourceModel: "whisper-large-v3",
        targetModel: "gpt-4",
        dimension: 1280,
        epsilon: 0.035,
        informationRetention: 0.95,
        category: "audio" as const,
        price: 59.99,
        downloads: 312,
        rating: 4.6,
      },
      {
        packageId: `vp_${Date.now()}_5`,
        userId: 1,
        name: "GPT-4 → Gemini Pro Multimodal Reasoning",
        description: "Multimodal reasoning specialist combining text, image, and structured data understanding. Ideal for data analysis and report generation.",
        vectorUrl: "https://example.com/vectors/multimodal-gpt4-gemini.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/multimodal-gpt4-gemini-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/multimodal-gpt4-gemini.vectorpkg",
        sourceModel: "gpt-4-vision",
        targetModel: "gemini-pro",
        dimension: 4096,
        epsilon: 0.031,
        informationRetention: 0.98,
        category: "multimodal" as const,
        price: 119.99,
        downloads: 203,
        rating: 4.9,
      },
    ];

    for (const pkg of vectorPkgs) {
      await db.insert(vectorPackages).values(pkg);
      console.log(`  ✓ ${pkg.name}`);
    }

    // Insert Memory Packages
    console.log("\n🧠 Inserting Memory Packages...");
    
    const memoryPkgs = [
      {
        packageId: `mp_${Date.now()}_1`,
        userId: 1,
        name: "GPT-4 Financial Analysis Session",
        description: "Complete reasoning state from analyzing Q3 2024 earnings reports. Includes market trend analysis and investment recommendations.",
        kvCacheUrl: "https://example.com/memories/finance-q3-2024.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/finance-q3-2024-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/finance-q3-2024.memorypkg",
        sourceModel: "gpt-4",
        targetModel: "claude-3-opus",
        epsilon: 0.028,
        informationRetention: 0.96,
        tokenCount: 8192,
        compressionRatio: 0.95,
        contextDescription: "Financial analysis of tech sector Q3 2024 earnings",
        price: 79.99,
        downloads: 156,
        rating: 4.8,
      },
      {
        packageId: `mp_${Date.now()}_2`,
        userId: 1,
        name: "Claude-3 Legal Contract Review Memory",
        description: "Reasoning state from reviewing 50+ SaaS contracts. Captures clause analysis patterns and risk identification strategies.",
        kvCacheUrl: "https://example.com/memories/legal-contracts.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/legal-contracts-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/legal-contracts.memorypkg",
        sourceModel: "claude-3-opus",
        targetModel: "gpt-4",
        epsilon: 0.032,
        informationRetention: 0.94,
        tokenCount: 12288,
        compressionRatio: 0.93,
        contextDescription: "SaaS contract review and risk assessment",
        price: 129.99,
        downloads: 89,
        rating: 4.9,
      },
      {
        packageId: `mp_${Date.now()}_3`,
        userId: 1,
        name: "LLaMA-3 Code Debugging Session",
        description: "Complete debugging session for microservices architecture. Includes root cause analysis and fix strategies.",
        kvCacheUrl: "https://example.com/memories/debug-microservices.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/debug-microservices-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/debug-microservices.memorypkg",
        sourceModel: "llama-3-70b",
        targetModel: "gpt-4",
        epsilon: 0.036,
        informationRetention: 0.92,
        tokenCount: 16384,
        compressionRatio: 0.91,
        contextDescription: "Microservices debugging and performance optimization",
        price: 59.99,
        downloads: 234,
        rating: 4.7,
      },
      {
        packageId: `mp_${Date.now()}_4`,
        userId: 1,
        name: "GPT-4 Medical Diagnosis Reasoning",
        description: "Diagnostic reasoning from 20+ complex medical cases. Captures differential diagnosis process and treatment planning.",
        kvCacheUrl: "https://example.com/memories/medical-diagnosis.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/medical-diagnosis-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/medical-diagnosis.memorypkg",
        sourceModel: "gpt-4",
        targetModel: "gemini-pro",
        epsilon: 0.029,
        informationRetention: 0.97,
        tokenCount: 10240,
        compressionRatio: 0.94,
        contextDescription: "Complex medical case diagnosis and treatment planning",
        price: 149.99,
        downloads: 67,
        rating: 4.9,
      },
      {
        packageId: `mp_${Date.now()}_5`,
        userId: 1,
        name: "Claude-3 Research Paper Analysis",
        description: "Complete analysis of 30+ AI research papers from NeurIPS 2024. Academic-grade insights and methodology evaluation.",
        kvCacheUrl: "https://example.com/memories/research-neurips2024.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/research-neurips2024-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/research-neurips2024.memorypkg",
        sourceModel: "claude-3-opus",
        targetModel: "gpt-4",
        epsilon: 0.034,
        informationRetention: 0.93,
        tokenCount: 20480,
        compressionRatio: 0.89,
        contextDescription: "NeurIPS 2024 paper analysis and synthesis",
        price: 99.99,
        downloads: 123,
        rating: 4.8,
      },
    ];

    for (const pkg of memoryPkgs) {
      await db.insert(memoryPackages).values(pkg);
      console.log(`  ✓ ${pkg.name}`);
    }

    // Insert Chain Packages
    console.log("\n⛓️  Inserting Chain Packages...");
    
    const chainPkgs = [
      {
        packageId: `cp_${Date.now()}_1`,
        userId: 1,
        name: "Algorithm Design: Dynamic Programming",
        description: "Step-by-step reasoning chain for solving complex DP problems. Covers pattern recognition and state definition.",
        chainUrl: "https://example.com/chains/dp-algorithm.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/dp-algorithm-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/dp-algorithm.chainpkg",
        sourceModel: "gpt-4",
        targetModel: "claude-3-opus",
        epsilon: 0.027,
        informationRetention: 0.98,
        stepCount: 15,
        problemType: "algorithm",
        solutionQuality: 0.96,
        price: 49.99,
        downloads: 267,
        rating: 4.9,
      },
      {
        packageId: `cp_${Date.now()}_2`,
        userId: 1,
        name: "Business Case Analysis: Market Entry",
        description: "Complete reasoning process for evaluating market entry opportunities. MBA-level framework with financial modeling.",
        chainUrl: "https://example.com/chains/market-entry.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/market-entry-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/market-entry.chainpkg",
        sourceModel: "claude-3-opus",
        targetModel: "gpt-4",
        epsilon: 0.031,
        informationRetention: 0.95,
        stepCount: 12,
        problemType: "business",
        solutionQuality: 0.94,
        price: 89.99,
        downloads: 134,
        rating: 4.8,
      },
      {
        packageId: `cp_${Date.now()}_3`,
        userId: 1,
        name: "System Design: Distributed Cache",
        description: "Complete reasoning chain for designing distributed caching systems. Production-tested approach with failure handling.",
        chainUrl: "https://example.com/chains/distributed-cache.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/distributed-cache-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/distributed-cache.chainpkg",
        sourceModel: "claude-3-opus",
        targetModel: "gpt-4",
        epsilon: 0.033,
        informationRetention: 0.94,
        stepCount: 14,
        problemType: "system-design",
        solutionQuality: 0.93,
        price: 99.99,
        downloads: 178,
        rating: 4.8,
      },
      {
        packageId: `cp_${Date.now()}_4`,
        userId: 1,
        name: "Machine Learning: Model Selection",
        description: "Step-by-step reasoning for selecting the right ML model. Kaggle-tested approach with hyperparameter tuning.",
        chainUrl: "https://example.com/chains/model-selection.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/model-selection-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/model-selection.chainpkg",
        sourceModel: "llama-3-70b",
        targetModel: "gpt-4",
        epsilon: 0.036,
        informationRetention: 0.93,
        stepCount: 14,
        problemType: "ml",
        solutionQuality: 0.93,
        price: 59.99,
        downloads: 234,
        rating: 4.7,
      },
      {
        packageId: `cp_${Date.now()}_5`,
        userId: 1,
        name: "Cybersecurity: Threat Analysis",
        description: "Complete threat analysis reasoning chain. CISO-approved methodology for vulnerability assessment and remediation.",
        chainUrl: "https://example.com/chains/threat-analysis.safetensors",
        wMatrixUrl: "https://example.com/wmatrices/threat-analysis-wmatrix.safetensors",
        packageUrl: "https://example.com/packages/threat-analysis.chainpkg",
        sourceModel: "gpt-4",
        targetModel: "claude-3-opus",
        epsilon: 0.030,
        informationRetention: 0.96,
        stepCount: 16,
        problemType: "security",
        solutionQuality: 0.95,
        price: 119.99,
        downloads: 123,
        rating: 4.9,
      },
    ];

    for (const pkg of chainPkgs) {
      await db.insert(chainPackages).values(pkg);
      console.log(`  ✓ ${pkg.name}`);
    }

    console.log("\n✅ Sample data generation complete!");
    console.log(`\n📊 Summary:`);
    console.log(`  - Vector Packages: ${vectorPkgs.length}`);
    console.log(`  - Memory Packages: ${memoryPkgs.length}`);
    console.log(`  - Chain Packages: ${chainPkgs.length}`);
    console.log(`  - Total: ${vectorPkgs.length + memoryPkgs.length + chainPkgs.length} packages`);
  } catch (error) {
    console.error("❌ Error generating sample data:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
