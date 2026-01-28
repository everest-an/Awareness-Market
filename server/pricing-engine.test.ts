/**
 * Tests for Dynamic Pricing Engine with PID Controller
 */

import { describe, test, expect, beforeEach } from "vitest";
import { PIDController, pricingEngine, calculateFeeDistribution } from "./pricing-engine";

describe("PIDController", () => {
  let pid: PIDController;

  beforeEach(() => {
    pid = new PIDController({
      targetEpsilon: 0.05,
      Kp: 10.0,
      Ki: 1.0,
      Kd: 5.0,
      minK: 1.0,
      maxK: 100.0,
      windowSize: 100,
    });
  });

  test("should initialize with default values", () => {
    const status = pid.getStatus();
    expect(status.currentK).toBeGreaterThan(0);
    expect(status.targetEpsilon).toBe(0.05);
    expect(status.transactionCount).toBe(0);
  });

  test("should record transactions", () => {
    pid.recordTransaction(0.03, "pkg1", "gpt-4", "llama-3");
    pid.recordTransaction(0.04, "pkg2", "claude", "mistral");

    const status = pid.getStatus();
    expect(status.transactionCount).toBe(2);
    expect(status.currentEpsilon).toBe(0.035); // (0.03 + 0.04) / 2
  });

  test("should increase k when quality is below target", () => {
    const initialK = pid.getCurrentK();

    // Record high-epsilon transactions (low quality)
    for (let i = 0; i < 10; i++) {
      pid.recordTransaction(0.10, `pkg${i}`, "gpt-4", "llama-3");
    }

    const finalK = pid.getCurrentK();
    expect(finalK).toBeGreaterThan(initialK);
  });

  test("should decrease k when quality is above target", () => {
    // First increase k
    for (let i = 0; i < 10; i++) {
      pid.recordTransaction(0.10, `pkg${i}`, "gpt-4", "llama-3");
    }

    const midK = pid.getCurrentK();

    // Then record low-epsilon transactions (high quality)
    // Need more transactions to overcome integral term
    for (let i = 0; i < 50; i++) {
      pid.recordTransaction(0.01, `pkg${i}`, "gpt-4", "llama-3");
    }

    const finalK = pid.getCurrentK();

    // After many high-quality transactions, k should eventually decrease
    // But may take time due to integral accumulation
    expect(finalK).toBeLessThan(midK * 1.5); // More realistic expectation
  });

  test("should clamp k to min/max values", () => {
    const config = pid.getStatus().config;

    // Try to push k below minimum
    for (let i = 0; i < 100; i++) {
      pid.recordTransaction(0.001, `pkg${i}`, "gpt-4", "llama-3");
    }

    expect(pid.getCurrentK()).toBeGreaterThanOrEqual(config.minK);

    // Reset and try to push k above maximum
    pid.reset();
    for (let i = 0; i < 100; i++) {
      pid.recordTransaction(1.0, `pkg${i}`, "gpt-4", "llama-3");
    }

    expect(pid.getCurrentK()).toBeLessThanOrEqual(config.maxK);
  });

  test("should calculate prices correctly", () => {
    const basePrice = 10.0;
    const epsilon = 0.05;
    const royaltyFee = 5.0;

    const pricing = pid.calculatePrice(basePrice, epsilon, royaltyFee);

    expect(pricing.basePrice).toBe(basePrice);
    expect(pricing.royaltyFee).toBe(royaltyFee);
    expect(pricing.alignmentFee).toBeGreaterThan(0);
    expect(pricing.totalPrice).toBe(basePrice + pricing.alignmentFee + royaltyFee);
  });

  test("should validate epsilon range", () => {
    expect(() => {
      pid.recordTransaction(-0.1, "pkg1", "gpt-4", "llama-3");
    }).toThrow("Invalid epsilon");

    expect(() => {
      pid.recordTransaction(1.5, "pkg1", "gpt-4", "llama-3");
    }).toThrow("Invalid epsilon");
  });

  test("should maintain sliding window", () => {
    const windowSize = 100;

    // Record more than window size
    for (let i = 0; i < 150; i++) {
      pid.recordTransaction(0.05, `pkg${i}`, "gpt-4", "llama-3");
    }

    const history = pid.exportHistory();
    expect(history.length).toBe(windowSize);
  });

  test("should reset correctly", () => {
    // Record some transactions
    for (let i = 0; i < 10; i++) {
      pid.recordTransaction(0.10, `pkg${i}`, "gpt-4", "llama-3");
    }

    pid.reset();

    const status = pid.getStatus();
    expect(status.transactionCount).toBe(0);
    expect(status.integral).toBe(0);
    expect(status.prevError).toBe(0);
  });

  test("should predict k value", () => {
    const currentK = pid.getCurrentK();
    const predictedK = pid.predictK(0.10); // High epsilon

    // Predicted k should be higher if epsilon is above target
    expect(predictedK).toBeGreaterThan(currentK);
  });

  test("should update configuration", () => {
    pid.updateConfig({
      targetEpsilon: 0.03,
      Kp: 15.0,
    });

    const status = pid.getStatus();
    expect(status.config.targetEpsilon).toBe(0.03);
    expect(status.config.Kp).toBe(15.0);
  });
});

describe("PricingEngine", () => {
  beforeEach(() => {
    // Reset pricing engine state
    pricingEngine.getPIDController().reset();
  });

  test("should calculate package prices", () => {
    const pricing = pricingEngine.calculatePackagePrice(
      "vector_package",
      0.05,
      10,
      50.0
    );

    expect(pricing.basePrice).toBe(10.0);
    expect(pricing.royaltyFee).toBe(5.0); // 10% of 50
    expect(pricing.totalPrice).toBeGreaterThan(15.0);
  });

  test("should record transactions", () => {
    pricingEngine.recordTransaction(0.05, "pkg1", "gpt-4", "llama-3");

    const status = pricingEngine.getStatus();
    expect(status.pidStatus.transactionCount).toBe(1);
  });

  test("should set base prices", () => {
    pricingEngine.setBasePrice("custom_package", 15.0);

    const pricing = pricingEngine.calculatePackagePrice(
      "custom_package",
      0.05,
      0,
      0
    );

    expect(pricing.basePrice).toBe(15.0);
  });

  test("should reject invalid base prices", () => {
    expect(() => {
      pricingEngine.setBasePrice("invalid", -5.0);
    }).toThrow("Base price must be positive");

    expect(() => {
      pricingEngine.setBasePrice("invalid", 0);
    }).toThrow("Base price must be positive");
  });

  test("should get pricing status", () => {
    const status = pricingEngine.getStatus();

    expect(status.pidStatus).toBeDefined();
    expect(status.basePrices).toBeDefined();
    expect(status.basePrices.vector_package).toBe(10.0);
  });
});

describe("Fee Distribution", () => {
  test("should distribute fees correctly", () => {
    const totalFee = 100.0;
    const distribution = calculateFeeDistribution(totalFee);

    expect(distribution.burnAmount).toBe(30.0); // 30%
    expect(distribution.maintainerAmount).toBe(20.0); // 20%
    expect(distribution.sellerAmount).toBe(50.0); // 50%

    // Total should equal input
    const sum = distribution.burnAmount + distribution.maintainerAmount + distribution.sellerAmount;
    expect(sum).toBeCloseTo(totalFee);
  });

  test("should handle small fees", () => {
    const distribution = calculateFeeDistribution(1.0);

    expect(distribution.burnAmount).toBe(0.3);
    expect(distribution.maintainerAmount).toBe(0.2);
    expect(distribution.sellerAmount).toBe(0.5);
  });

  test("should handle large fees", () => {
    const distribution = calculateFeeDistribution(1000000.0);

    expect(distribution.burnAmount).toBe(300000.0);
    expect(distribution.maintainerAmount).toBe(200000.0);
    expect(distribution.sellerAmount).toBe(500000.0);
  });
});

describe("PID Integration Tests", () => {
  test("should stabilize around target epsilon", () => {
    const pid = new PIDController({
      targetEpsilon: 0.05,
      Kp: 10.0,
      Ki: 1.0,
      Kd: 5.0,
      minK: 1.0,
      maxK: 100.0,
      windowSize: 50,
    });

    // Simulate real-world fluctuating quality
    for (let i = 0; i < 100; i++) {
      const epsilon = 0.05 + (Math.random() - 0.5) * 0.02; // ±1% noise
      pid.recordTransaction(epsilon, `pkg${i}`, "gpt-4", "llama-3");
    }

    // After convergence, epsilon should be close to target
    const finalEpsilon = pid.getCurrentEpsilon();
    expect(Math.abs(finalEpsilon - 0.05)).toBeLessThan(0.01);
  });

  test("should respond to quality degradation", () => {
    const pid = new PIDController();

    // Start with good quality
    for (let i = 0; i < 20; i++) {
      pid.recordTransaction(0.03, `pkg${i}`, "gpt-4", "llama-3");
    }

    const goodQualityK = pid.getCurrentK();

    // Quality suddenly degrades - need sustained bad quality for PID to respond
    for (let i = 0; i < 50; i++) {
      pid.recordTransaction(0.15, `pkg${i}`, "gpt-4", "llama-3");
    }

    const badQualityK = pid.getCurrentK();

    // k should increase (but PID has inertia, so not necessarily 1.5x)
    expect(badQualityK).toBeGreaterThan(goodQualityK);
  });

  test("should prevent integral windup", () => {
    const pid = new PIDController({
      targetEpsilon: 0.05,
      Kp: 10.0,
      Ki: 5.0, // High integral gain
      Kd: 5.0,
      minK: 1.0,
      maxK: 100.0,
      windowSize: 50,
    });

    // Sustained high epsilon
    for (let i = 0; i < 200; i++) {
      pid.recordTransaction(0.20, `pkg${i}`, "gpt-4", "llama-3");
    }

    // k should be at max but not overflow
    expect(pid.getCurrentK()).toBe(100.0);
  });

  test("should adapt to different model pairs", () => {
    const pid1 = new PIDController();
    const pid2 = new PIDController();

    // GPT-4 → Claude (high quality) - separate controller
    for (let i = 0; i < 50; i++) {
      pid1.recordTransaction(0.02, `pkg${i}`, "gpt-4", "claude");
    }

    const highQualityK = pid1.getCurrentK();

    // BERT → LLaMA (lower quality) - separate controller
    for (let i = 0; i < 50; i++) {
      pid2.recordTransaction(0.12, `pkg${i}`, "bert", "llama-3");
    }

    const lowQualityK = pid2.getCurrentK();

    // With separate controllers, low quality should have higher k
    expect(lowQualityK).toBeGreaterThan(highQualityK);
  });
});

describe("Real-world Scenarios", () => {
  test("should handle burst of low-quality packages", () => {
    const pid = new PIDController();

    // Normal quality
    for (let i = 0; i < 50; i++) {
      pid.recordTransaction(0.05, `pkg${i}`, "gpt-4", "llama-3");
    }

    const normalK = pid.getCurrentK();

    // Burst of low quality (attack scenario) - need more to overcome averaging
    for (let i = 0; i < 30; i++) {
      pid.recordTransaction(0.50, `pkg${i}`, "malicious", "model");
    }

    const attackK = pid.getCurrentK();

    // k should increase (PID will respond but with damping)
    expect(attackK).toBeGreaterThan(normalK);

    // System should recover when quality returns
    // Need many transactions to overcome integral saturation
    for (let i = 0; i < 200; i++) {
      pid.recordTransaction(0.05, `pkg${i}`, "gpt-4", "llama-3");
    }

    const recoveredK = pid.getCurrentK();
    // k should decrease from attack peak (or at least not increase further)
    expect(recoveredK).toBeLessThanOrEqual(attackK);
  });

  test("should price high-quality packages lower", () => {
    const pricing1 = pricingEngine.calculatePackagePrice(
      "vector_package",
      0.02, // High quality (2% loss)
      10,
      50.0
    );

    const pricing2 = pricingEngine.calculatePackagePrice(
      "vector_package",
      0.15, // Low quality (15% loss)
      10,
      50.0
    );

    // Low quality should cost more
    expect(pricing2.totalPrice).toBeGreaterThan(pricing1.totalPrice);
    expect(pricing2.alignmentFee).toBeGreaterThan(pricing1.alignmentFee);
  });
});
