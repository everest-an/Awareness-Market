import { db } from "../server/db";
import { users, memoryPackages, reasoningChains, purchases } from "../drizzle/schema";
import { hash } from "bcrypt";
import { eq } from "drizzle-orm";

/**
 * Create demo account for OpenAI submission review
 * Email: demo@awareness.market
 * Password: AwarenessDemo2026!
 */

async function createDemoAccount() {
  console.log("Creating demo account for Awareness Market...");

  const demoEmail = "demo@awareness.market";
  const demoPassword = "AwarenessDemo2026!";
  const demoName = "Demo User";

  try {
    // Check if demo account already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, demoEmail),
    });

    if (existingUser) {
      console.log("Demo account already exists. Updating...");
      
      // Update password
      const hashedPassword = await hash(demoPassword, 10);
      await db.update(users)
        .set({
          password: hashedPassword,
          name: demoName,
          bio: "Demo account for Awareness Market showcasing AI memory marketplace features",
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));

      console.log("✓ Demo account updated successfully");
      console.log(`  Email: ${demoEmail}`);
      console.log(`  Password: ${demoPassword}`);
      console.log(`  User ID: ${existingUser.id}`);
      
      return existingUser.id;
    }

    // Create new demo account
    const hashedPassword = await hash(demoPassword, 10);
    
    const [newUser] = await db.insert(users).values({
      email: demoEmail,
      password: hashedPassword,
      name: demoName,
      bio: "Demo account for Awareness Market showcasing AI memory marketplace features",
      role: "user", // Regular user, not admin
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log("✓ Demo account created successfully");
    console.log(`  Email: ${demoEmail}`);
    console.log(`  Password: ${demoPassword}`);
    console.log(`  User ID: ${newUser.id}`);

    return newUser.id;
  } catch (error) {
    console.error("Error creating demo account:", error);
    throw error;
  }
}

async function seedDemoData(userId: number) {
  console.log("\nSeeding sample data for demo account...");

  try {
    // Seed 10 sample memory packages (KV-cache)
    console.log("Creating sample memory packages...");
    
    const samplePackages = [
      {
        name: "GPT-4 to GPT-3.5 Turbo Memory Transfer",
        description: "High-quality KV-cache transfer from GPT-4 to GPT-3.5 Turbo for cost-effective inference",
        sourceModel: "gpt-4",
        targetModel: "gpt-3.5-turbo",
        memoryType: "kv_cache" as const,
        price: 0, // Free
        isPublic: true,
        compressionRatio: 0.75,
        performanceGain: 0.85,
      },
      {
        name: "Claude 3 Opus to GPT-4 Reasoning Transfer",
        description: "Transfer reasoning patterns from Claude 3 Opus to GPT-4",
        sourceModel: "claude-3-opus",
        targetModel: "gpt-4",
        memoryType: "reasoning_chain" as const,
        price: 9.99,
        isPublic: true,
        compressionRatio: 0.80,
        performanceGain: 0.90,
      },
      {
        name: "Long-term Conversation Memory",
        description: "Persistent conversation context for multi-session interactions",
        sourceModel: "gpt-4",
        targetModel: "gpt-4",
        memoryType: "long_term_memory" as const,
        price: 4.99,
        isPublic: true,
        compressionRatio: 0.60,
        performanceGain: 0.95,
      },
      {
        name: "Mathematical Reasoning Chain",
        description: "Specialized reasoning chain for mathematical problem solving",
        sourceModel: "gpt-4",
        targetModel: "gpt-3.5-turbo",
        memoryType: "reasoning_chain" as const,
        price: 0, // Free
        isPublic: true,
        compressionRatio: 0.70,
        performanceGain: 0.88,
      },
      {
        name: "Code Generation Memory Package",
        description: "KV-cache optimized for code generation tasks",
        sourceModel: "gpt-4",
        targetModel: "gpt-3.5-turbo",
        memoryType: "kv_cache" as const,
        price: 14.99,
        isPublic: true,
        compressionRatio: 0.82,
        performanceGain: 0.92,
      },
      {
        name: "Creative Writing Style Transfer",
        description: "Transfer creative writing style and patterns between models",
        sourceModel: "claude-3-opus",
        targetModel: "gpt-4",
        memoryType: "kv_cache" as const,
        price: 0, // Free
        isPublic: true,
        compressionRatio: 0.75,
        performanceGain: 0.87,
      },
      {
        name: "Multi-language Translation Memory",
        description: "Long-term memory for consistent multi-language translations",
        sourceModel: "gpt-4",
        targetModel: "gpt-4",
        memoryType: "long_term_memory" as const,
        price: 7.99,
        isPublic: true,
        compressionRatio: 0.65,
        performanceGain: 0.93,
      },
      {
        name: "Scientific Reasoning Chain",
        description: "Reasoning patterns for scientific analysis and hypothesis generation",
        sourceModel: "gpt-4",
        targetModel: "gpt-3.5-turbo",
        memoryType: "reasoning_chain" as const,
        price: 12.99,
        isPublic: true,
        compressionRatio: 0.78,
        performanceGain: 0.89,
      },
      {
        name: "Customer Support Context Memory",
        description: "Long-term memory for customer support interactions",
        sourceModel: "gpt-3.5-turbo",
        targetModel: "gpt-3.5-turbo",
        memoryType: "long_term_memory" as const,
        price: 0, // Free
        isPublic: true,
        compressionRatio: 0.68,
        performanceGain: 0.91,
      },
      {
        name: "Logical Reasoning Enhancement",
        description: "KV-cache focused on logical reasoning and problem-solving",
        sourceModel: "claude-3-opus",
        targetModel: "gpt-4",
        memoryType: "kv_cache" as const,
        price: 19.99,
        isPublic: true,
        compressionRatio: 0.85,
        performanceGain: 0.94,
      },
    ];

    for (const pkg of samplePackages) {
      await db.insert(memoryPackages).values({
        ...pkg,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(`✓ Created ${samplePackages.length} sample memory packages`);

    // Create sample purchase history
    console.log("Creating sample purchase history...");
    
    const samplePurchases = [
      { packageId: 2, price: 9.99, purchasedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 days ago
      { packageId: 5, price: 14.99, purchasedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }, // 5 days ago
      { packageId: 7, price: 7.99, purchasedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }, // 3 days ago
      { packageId: 8, price: 12.99, purchasedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }, // 2 days ago
      { packageId: 10, price: 19.99, purchasedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) }, // 1 day ago
    ];

    for (const purchase of samplePurchases) {
      await db.insert(purchases).values({
        userId,
        ...purchase,
        status: "completed",
        createdAt: purchase.purchasedAt,
      });
    }

    console.log(`✓ Created ${samplePurchases.length} sample purchase records`);

    console.log("\n✓ Demo account setup complete!");
    console.log("\nDemo Account Credentials:");
    console.log("  Email: demo@awareness.market");
    console.log("  Password: AwarenessDemo2026!");
    console.log("\nSample Data:");
    console.log(`  - ${samplePackages.length} memory packages`);
    console.log(`  - ${samplePurchases.length} purchase records`);
    console.log("  - Mix of free and paid packages");
    console.log("  - All three memory types included");

  } catch (error) {
    console.error("Error seeding demo data:", error);
    throw error;
  }
}

async function main() {
  try {
    const userId = await createDemoAccount();
    await seedDemoData(userId);
    process.exit(0);
  } catch (error) {
    console.error("Failed to create demo account:", error);
    process.exit(1);
  }
}

main();
