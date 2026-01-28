/**
 * Dynamic Pricing Engine with PID Controller
 *
 * Implements the PID (Proportional-Integral-Derivative) controller
 * for dynamic market pricing based on alignment quality.
 *
 * Reference: Whitepaper Section 12.3 "PID Controller for k Parameter"
 *
 * Formula:
 * P_total = P_base + (k × ε) + P_royalty
 *
 * Where:
 * - ε: alignment loss (epsilon)
 * - k: quality lever parameter (dynamically adjusted by PID)
 * - P_base: base communication fee
 * - P_royalty: copyright fee
 */

interface PIDConfig {
  // Target alignment loss (epsilon_target)
  targetEpsilon: number;

  // PID coefficients
  Kp: number; // Proportional gain
  Ki: number; // Integral gain
  Kd: number; // Derivative gain

  // Constraints
  minK: number; // Minimum k value
  maxK: number; // Maximum k value

  // Sliding window size for averaging
  windowSize: number;
}

interface PricingResult {
  totalPrice: number;
  basePrice: number;
  alignmentFee: number;
  royaltyFee: number;
  currentK: number;
  currentEpsilon: number;
}

interface TransactionRecord {
  timestamp: Date;
  epsilon: number;
  packageId: string;
  sourceModel: string;
  targetModel: string;
}

/**
 * PID Controller for Dynamic k Parameter
 *
 * Automatically adjusts the market's "quality lever" (k) based on
 * network-wide average alignment quality.
 */
export class PIDController {
  private config: PIDConfig;
  private integral: number = 0;
  private prevError: number = 0;
  private currentK: number;
  private transactionHistory: TransactionRecord[] = [];

  constructor(config: Partial<PIDConfig> = {}) {
    // Default configuration (tuned for production)
    this.config = {
      targetEpsilon: 0.05, // 5% target alignment loss (95% quality)
      Kp: 10.0, // Proportional coefficient
      Ki: 1.0, // Integral coefficient
      Kd: 5.0, // Derivative coefficient
      minK: 1.0, // Minimum quality lever
      maxK: 100.0, // Maximum quality lever
      windowSize: 100, // Consider last 100 transactions
      ...config,
    };

    // Initialize k at midpoint
    this.currentK = (this.config.minK + this.config.maxK) / 2;
  }

  /**
   * Record a new transaction and update k parameter
   *
   * @param epsilon - Alignment loss (0-1, where 0 = perfect)
   * @param packageId - Package identifier
   * @param sourceModel - Source model name
   * @param targetModel - Target model name
   * @returns Updated k parameter
   */
  recordTransaction(
    epsilon: number,
    packageId: string,
    sourceModel: string,
    targetModel: string
  ): number {
    // Validate epsilon
    if (epsilon < 0 || epsilon > 1) {
      throw new Error(`Invalid epsilon: ${epsilon}. Must be in range [0, 1]`);
    }

    // Add to history
    this.transactionHistory.push({
      timestamp: new Date(),
      epsilon,
      packageId,
      sourceModel,
      targetModel,
    });

    // Keep only last N transactions (sliding window)
    if (this.transactionHistory.length > this.config.windowSize) {
      this.transactionHistory.shift();
    }

    // Update k parameter
    this.currentK = this.updateK();

    return this.currentK;
  }

  /**
   * Update k parameter using PID control algorithm
   *
   * @returns New k value
   */
  private updateK(): number {
    // Calculate current average epsilon
    const currentAvgEpsilon = this.calculateAverageEpsilon();

    // Error term: current average epsilon - target epsilon
    const error = currentAvgEpsilon - this.config.targetEpsilon;

    // Proportional term
    const proportional = this.config.Kp * error;

    // Integral term (with anti-windup)
    this.integral += error;
    // Anti-windup: clamp integral to prevent accumulation
    this.integral = Math.max(
      -this.config.maxK / this.config.Ki,
      Math.min(this.config.maxK / this.config.Ki, this.integral)
    );
    const integral = this.config.Ki * this.integral;

    // Derivative term
    const derivative = this.config.Kd * (error - this.prevError);
    this.prevError = error;

    // Calculate adjustment
    const adjustment = proportional + integral + derivative;

    // Update k with clamping
    const newK = Math.max(
      this.config.minK,
      Math.min(this.config.maxK, this.currentK + adjustment)
    );

    return newK;
  }

  /**
   * Calculate average epsilon over sliding window
   *
   * @returns Average epsilon
   */
  private calculateAverageEpsilon(): number {
    if (this.transactionHistory.length === 0) {
      return this.config.targetEpsilon; // No data, assume target
    }

    const sum = this.transactionHistory.reduce((acc, tx) => acc + tx.epsilon, 0);
    return sum / this.transactionHistory.length;
  }

  /**
   * Calculate price for a memory transaction
   *
   * @param basePrice - Base communication fee ($AMEM)
   * @param epsilon - Alignment loss for this transaction
   * @param royaltyFee - Copyright fee ($AMEM)
   * @returns Pricing breakdown
   */
  calculatePrice(
    basePrice: number,
    epsilon: number,
    royaltyFee: number
  ): PricingResult {
    // Alignment compensation fee
    const alignmentFee = this.currentK * epsilon;

    // Total price
    const totalPrice = basePrice + alignmentFee + royaltyFee;

    return {
      totalPrice,
      basePrice,
      alignmentFee,
      royaltyFee,
      currentK: this.currentK,
      currentEpsilon: epsilon,
    };
  }

  /**
   * Get current k parameter
   *
   * @returns Current k value
   */
  getCurrentK(): number {
    return this.currentK;
  }

  /**
   * Get current average epsilon
   *
   * @returns Average alignment loss
   */
  getCurrentEpsilon(): number {
    return this.calculateAverageEpsilon();
  }

  /**
   * Get PID controller status
   *
   * @returns Status information
   */
  getStatus() {
    return {
      currentK: this.currentK,
      targetEpsilon: this.config.targetEpsilon,
      currentEpsilon: this.calculateAverageEpsilon(),
      integral: this.integral,
      prevError: this.prevError,
      transactionCount: this.transactionHistory.length,
      config: this.config,
    };
  }

  /**
   * Reset PID controller state
   */
  reset(): void {
    this.integral = 0;
    this.prevError = 0;
    this.currentK = (this.config.minK + this.config.maxK) / 2;
    this.transactionHistory = [];
  }

  /**
   * Update PID configuration
   *
   * @param newConfig - Partial configuration update
   */
  updateConfig(newConfig: Partial<PIDConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Export transaction history for analysis
   *
   * @returns Transaction history
   */
  exportHistory(): TransactionRecord[] {
    return [...this.transactionHistory];
  }

  /**
   * Predict future k value based on hypothetical epsilon
   *
   * @param hypotheticalEpsilon - Hypothetical alignment loss
   * @returns Predicted k value
   */
  predictK(hypotheticalEpsilon: number): number {
    const error = hypotheticalEpsilon - this.config.targetEpsilon;
    const proportional = this.config.Kp * error;
    const integral = this.config.Ki * this.integral;
    const derivative = this.config.Kd * (error - this.prevError);

    const adjustment = proportional + integral + derivative;
    const predictedK = Math.max(
      this.config.minK,
      Math.min(this.config.maxK, this.currentK + adjustment)
    );

    return predictedK;
  }
}

/**
 * Market-wide pricing engine singleton
 */
class PricingEngine {
  private pidController: PIDController;
  private basePrices: Map<string, number>; // Base prices by package type

  constructor() {
    this.pidController = new PIDController();

    // Default base prices ($AMEM)
    this.basePrices = new Map([
      ["vector_package", 10.0], // Latent vector package
      ["kv_cache", 5.0], // KV-Cache memory package
      ["reasoning_chain", 20.0], // Reasoning chain package
    ]);
  }

  /**
   * Calculate price for a package purchase
   *
   * @param packageType - Type of package
   * @param epsilon - Alignment loss
   * @param royaltyPercentage - Royalty percentage (0-100)
   * @param packagePrice - Original package price
   * @returns Pricing breakdown
   */
  calculatePackagePrice(
    packageType: string,
    epsilon: number,
    royaltyPercentage: number,
    packagePrice: number
  ): PricingResult {
    const basePrice = this.basePrices.get(packageType) || 10.0;
    const royaltyFee = (packagePrice * royaltyPercentage) / 100;

    return this.pidController.calculatePrice(basePrice, epsilon, royaltyFee);
  }

  /**
   * Record a transaction and update pricing model
   *
   * @param epsilon - Alignment loss
   * @param packageId - Package identifier
   * @param sourceModel - Source model name
   * @param targetModel - Target model name
   */
  recordTransaction(
    epsilon: number,
    packageId: string,
    sourceModel: string,
    targetModel: string
  ): void {
    this.pidController.recordTransaction(epsilon, packageId, sourceModel, targetModel);
  }

  /**
   * Set base price for a package type
   *
   * @param packageType - Package type
   * @param price - Base price in $AMEM
   */
  setBasePrice(packageType: string, price: number): void {
    if (price <= 0) {
      throw new Error("Base price must be positive");
    }
    this.basePrices.set(packageType, price);
  }

  /**
   * Get current pricing status
   *
   * @returns Status information
   */
  getStatus() {
    return {
      pidStatus: this.pidController.getStatus(),
      basePrices: Object.fromEntries(this.basePrices),
    };
  }

  /**
   * Get PID controller instance (for advanced usage)
   *
   * @returns PID controller
   */
  getPIDController(): PIDController {
    return this.pidController;
  }
}

// Export singleton instance
export const pricingEngine = new PricingEngine();

/**
 * Fee distribution according to whitepaper Section 10.5
 *
 * Distributes transaction fees:
 * - 30% burned (deflationary)
 * - 20% to W-Matrix maintainers
 * - 50% to seller/creator
 */
export interface FeeDistribution {
  burnAmount: number;
  maintainerAmount: number;
  sellerAmount: number;
}

/**
 * Calculate fee distribution
 *
 * @param totalFee - Total fee amount
 * @returns Fee distribution breakdown
 */
export function calculateFeeDistribution(totalFee: number): FeeDistribution {
  const burnAmount = totalFee * 0.3; // 30% burned
  const maintainerAmount = totalFee * 0.2; // 20% to maintainers
  const sellerAmount = totalFee * 0.5; // 50% to seller

  return {
    burnAmount,
    maintainerAmount,
    sellerAmount,
  };
}

/**
 * Calculate total transaction cost for buyer
 *
 * @param packagePrice - Base package price
 * @param epsilon - Alignment loss
 * @param packageType - Type of package
 * @returns Total cost including all fees
 */
export function calculateTotalCost(
  packagePrice: number,
  epsilon: number,
  packageType: string
): number {
  const pricing = pricingEngine.calculatePackagePrice(
    packageType,
    epsilon,
    10, // Default 10% royalty
    packagePrice
  );

  return pricing.totalPrice;
}

// Re-export types
export type { PIDConfig, PricingResult, TransactionRecord };
