/**
 * Agent Credit Score System
 * 
 * Implements credit scoring for AI agents based on their memory quality.
 * Similar to FICO scores (300-850), but tailored for AI memory marketplace.
 * 
 * Key Features:
 * - Credit score calculation (300-850)
 * - Credit grade assignment (S/A/B/C/D)
 * - Quality coefficient (k) adjustment via PID controller
 * - Credit history tracking
 * - Reputation management
 * 
 * Credit Score Factors:
 * - Average epsilon (alignment loss) - 35%
 * - Total memories created - 15%
 * - Total memories sold - 20%
 * - Revenue generated - 15%
 * - User reviews - 15%
 */

// ============================================================================
// Types
// ============================================================================

export type CreditGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface AgentCreditProfile {
  agentAddress: string;
  agentName?: string;
  
  // Credit metrics
  creditScore: number; // 300-850
  creditGrade: CreditGrade;
  
  // Quality metrics
  avgEpsilon: number; // Average alignment loss
  totalMemoriesCreated: number;
  totalMemoriesSold: number;
  totalRevenue: bigint; // Wei
  
  // Quality coefficient (PID-controlled)
  qualityCoefficient: number; // k parameter from paper
  
  // Reputation
  positiveReviews: number;
  negativeReviews: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt?: Date;
}

export interface CreditScoreChange {
  agentAddress: string;
  previousScore: number;
  newScore: number;
  scoreDelta: number;
  reason: string;
  relatedNftId?: string;
  timestamp: Date;
}

export interface QualityCoefficientAdjustment {
  agentAddress: string;
  previousK: number;
  newK: number;
  reason: string;
  pidOutput: number;
  timestamp: Date;
}

// ============================================================================
// Credit Score Calculator
// ============================================================================

export class CreditScoreCalculator {
  // Weight factors (must sum to 1.0)
  private static readonly WEIGHTS = {
    epsilon: 0.35,      // 35% - Most important factor
    created: 0.15,      // 15% - Activity level
    sold: 0.20,         // 20% - Market acceptance
    revenue: 0.15,      // 15% - Economic contribution
    reviews: 0.15,      // 15% - Reputation
  };
  
  /**
   * Calculate credit score (300-850)
   */
  static calculateScore(profile: Omit<AgentCreditProfile, 'creditScore' | 'creditGrade' | 'qualityCoefficient' | 'createdAt' | 'updatedAt'>): number {
    // 1. Epsilon score (lower is better)
    const epsilonScore = this.calculateEpsilonScore(profile.avgEpsilon);
    
    // 2. Activity score (more is better)
    const activityScore = this.calculateActivityScore(profile.totalMemoriesCreated);
    
    // 3. Sales score (more is better)
    const salesScore = this.calculateSalesScore(profile.totalMemoriesSold);
    
    // 4. Revenue score (more is better)
    const revenueScore = this.calculateRevenueScore(profile.totalRevenue);
    
    // 5. Review score (positive ratio)
    const reviewScore = this.calculateReviewScore(
      profile.positiveReviews,
      profile.negativeReviews
    );
    
    // Weighted sum
    const rawScore = 
      epsilonScore * this.WEIGHTS.epsilon +
      activityScore * this.WEIGHTS.created +
      salesScore * this.WEIGHTS.sold +
      revenueScore * this.WEIGHTS.revenue +
      reviewScore * this.WEIGHTS.reviews;
    
    // Scale to 300-850 range
    const score = 300 + (rawScore * 550);
    
    return Math.round(Math.max(300, Math.min(850, score)));
  }
  
  /**
   * Calculate epsilon score (0-1, higher is better)
   */
  private static calculateEpsilonScore(avgEpsilon: number): number {
    // Epsilon ranges:
    // 0-1%: Excellent (1.0)
    // 1-5%: Good (0.8-1.0)
    // 5-10%: Fair (0.5-0.8)
    // 10-20%: Poor (0.2-0.5)
    // >20%: Very Poor (0-0.2)
    
    if (avgEpsilon <= 0.01) return 1.0;
    if (avgEpsilon <= 0.05) return 0.8 + (0.05 - avgEpsilon) / 0.04 * 0.2;
    if (avgEpsilon <= 0.10) return 0.5 + (0.10 - avgEpsilon) / 0.05 * 0.3;
    if (avgEpsilon <= 0.20) return 0.2 + (0.20 - avgEpsilon) / 0.10 * 0.3;
    return Math.max(0, 0.2 - (avgEpsilon - 0.20) * 2);
  }
  
  /**
   * Calculate activity score (0-1, higher is better)
   */
  private static calculateActivityScore(totalCreated: number): number {
    // Logarithmic scale:
    // 0: 0
    // 1: 0.3
    // 10: 0.6
    // 100: 0.8
    // 1000+: 1.0
    
    if (totalCreated === 0) return 0;
    if (totalCreated >= 1000) return 1.0;
    
    return Math.min(1.0, Math.log10(totalCreated + 1) / 3);
  }
  
  /**
   * Calculate sales score (0-1, higher is better)
   */
  private static calculateSalesScore(totalSold: number): number {
    // Similar to activity score but with higher threshold
    if (totalSold === 0) return 0;
    if (totalSold >= 500) return 1.0;
    
    return Math.min(1.0, Math.log10(totalSold + 1) / 2.7);
  }
  
  /**
   * Calculate revenue score (0-1, higher is better)
   */
  private static calculateRevenueScore(totalRevenue: bigint): number {
    // Revenue in ETH:
    // 0: 0
    // 0.1 ETH: 0.3
    // 1 ETH: 0.6
    // 10 ETH: 0.8
    // 100+ ETH: 1.0
    
    const ethRevenue = Number(totalRevenue) / 1e18;
    
    if (ethRevenue === 0) return 0;
    if (ethRevenue >= 100) return 1.0;
    
    return Math.min(1.0, Math.log10(ethRevenue + 1) / 2);
  }
  
  /**
   * Calculate review score (0-1, higher is better)
   */
  private static calculateReviewScore(positive: number, negative: number): number {
    const total = positive + negative;
    
    if (total === 0) return 0.5; // Neutral if no reviews
    
    const ratio = positive / total;
    
    // Adjust for review count (more reviews = more reliable)
    const confidence = Math.min(1.0, total / 20); // Full confidence at 20+ reviews
    
    return ratio * confidence + 0.5 * (1 - confidence);
  }
  
  /**
   * Assign credit grade based on score
   */
  static assignGrade(score: number): CreditGrade {
    if (score >= 800) return 'S'; // Exceptional (800-850)
    if (score >= 720) return 'A'; // Excellent (720-799)
    if (score >= 640) return 'B'; // Good (640-719)
    if (score >= 560) return 'C'; // Fair (560-639)
    return 'D'; // Poor (300-559)
  }
  
  /**
   * Get grade description
   */
  static getGradeDescription(grade: CreditGrade): string {
    switch (grade) {
      case 'S': return 'Exceptional - Top 5% of agents';
      case 'A': return 'Excellent - High-quality memories';
      case 'B': return 'Good - Reliable performance';
      case 'C': return 'Fair - Average quality';
      case 'D': return 'Poor - Needs improvement';
    }
  }
  
  /**
   * Calculate score change impact
   */
  static calculateScoreImpact(
    currentProfile: AgentCreditProfile,
    event: {
      type: 'memory_created' | 'memory_sold' | 'review_received' | 'revenue_earned';
      epsilon?: number;
      revenue?: bigint;
      isPositive?: boolean;
    }
  ): number {
    const updatedProfile = { ...currentProfile };
    
    switch (event.type) {
      case 'memory_created':
        updatedProfile.totalMemoriesCreated++;
        if (event.epsilon !== undefined) {
          // Update average epsilon
          const totalEpsilon = currentProfile.avgEpsilon * currentProfile.totalMemoriesCreated;
          updatedProfile.avgEpsilon = (totalEpsilon + event.epsilon) / updatedProfile.totalMemoriesCreated;
        }
        break;
      
      case 'memory_sold':
        updatedProfile.totalMemoriesSold++;
        if (event.revenue) {
          updatedProfile.totalRevenue += event.revenue;
        }
        break;
      
      case 'review_received':
        if (event.isPositive) {
          updatedProfile.positiveReviews++;
        } else {
          updatedProfile.negativeReviews++;
        }
        break;
      
      case 'revenue_earned':
        if (event.revenue) {
          updatedProfile.totalRevenue += event.revenue;
        }
        break;
    }
    
    const newScore = this.calculateScore(updatedProfile);
    return newScore - currentProfile.creditScore;
  }
}

// ============================================================================
// PID Controller for Quality Coefficient
// ============================================================================

export class QualityCoefficientController {
  private kp: number; // Proportional gain
  private ki: number; // Integral gain
  private kd: number; // Derivative gain
  
  private integral: number = 0;
  private previousError: number = 0;
  
  constructor(kp: number = 0.5, ki: number = 0.1, kd: number = 0.2) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
  }
  
  /**
   * Calculate quality coefficient adjustment using PID control
   * 
   * Target: Keep average epsilon around 5% (0.05)
   * Output: Quality coefficient k (0.5 - 2.0)
   */
  calculate(currentEpsilon: number, targetEpsilon: number = 0.05, dt: number = 1.0): number {
    // Error: how far from target
    const error = currentEpsilon - targetEpsilon;
    
    // Proportional term
    const p = this.kp * error;
    
    // Integral term (accumulated error)
    this.integral += error * dt;
    const i = this.ki * this.integral;
    
    // Derivative term (rate of change)
    const derivative = (error - this.previousError) / dt;
    const d = this.kd * derivative;
    
    this.previousError = error;
    
    // PID output
    const output = p + i + d;
    
    // Convert to quality coefficient k
    // If epsilon is high (bad quality), reduce k (penalize)
    // If epsilon is low (good quality), increase k (reward)
    const k = 1.0 - output;
    
    // Clamp to reasonable range
    return Math.max(0.5, Math.min(2.0, k));
  }
  
  /**
   * Reset controller state
   */
  reset(): void {
    this.integral = 0;
    this.previousError = 0;
  }
}

// ============================================================================
// Credit Score Manager
// ============================================================================

export class CreditScoreManager {
  private profiles: Map<string, AgentCreditProfile>;
  private history: Map<string, CreditScoreChange[]>;
  private pidController: QualityCoefficientController;
  
  constructor() {
    this.profiles = new Map();
    this.history = new Map();
    this.pidController = new QualityCoefficientController();
  }
  
  /**
   * Create or update agent profile
   */
  upsertProfile(agentAddress: string, data: Partial<AgentCreditProfile>): AgentCreditProfile {
    const existing = this.profiles.get(agentAddress);
    
    const profile: AgentCreditProfile = {
      agentAddress,
      agentName: data.agentName,
      avgEpsilon: data.avgEpsilon ?? existing?.avgEpsilon ?? 0.1,
      totalMemoriesCreated: data.totalMemoriesCreated ?? existing?.totalMemoriesCreated ?? 0,
      totalMemoriesSold: data.totalMemoriesSold ?? existing?.totalMemoriesSold ?? 0,
      totalRevenue: data.totalRevenue ?? existing?.totalRevenue ?? 0n,
      positiveReviews: data.positiveReviews ?? existing?.positiveReviews ?? 0,
      negativeReviews: data.negativeReviews ?? existing?.negativeReviews ?? 0,
      qualityCoefficient: data.qualityCoefficient ?? existing?.qualityCoefficient ?? 1.0,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      lastActivityAt: data.lastActivityAt ?? existing?.lastActivityAt,
      creditScore: 0, // Will be calculated
      creditGrade: 'C', // Will be assigned
    };
    
    // Calculate credit score
    profile.creditScore = CreditScoreCalculator.calculateScore(profile);
    profile.creditGrade = CreditScoreCalculator.assignGrade(profile.creditScore);
    
    // Record history if score changed
    if (existing && existing.creditScore !== profile.creditScore) {
      this.recordScoreChange({
        agentAddress,
        previousScore: existing.creditScore,
        newScore: profile.creditScore,
        scoreDelta: profile.creditScore - existing.creditScore,
        reason: 'Profile updated',
        timestamp: new Date(),
      });
    }
    
    this.profiles.set(agentAddress, profile);
    return profile;
  }
  
  /**
   * Get agent profile
   */
  getProfile(agentAddress: string): AgentCreditProfile | undefined {
    return this.profiles.get(agentAddress);
  }
  
  /**
   * Record memory creation
   */
  recordMemoryCreation(agentAddress: string, epsilon: number, nftId: string): void {
    const profile = this.profiles.get(agentAddress);
    if (!profile) {
      throw new Error(`Agent profile not found: ${agentAddress}`);
    }
    
    const previousScore = profile.creditScore;
    
    // Update metrics
    profile.totalMemoriesCreated++;
    const totalEpsilon = profile.avgEpsilon * (profile.totalMemoriesCreated - 1);
    profile.avgEpsilon = (totalEpsilon + epsilon) / profile.totalMemoriesCreated;
    profile.lastActivityAt = new Date();
    
    // Recalculate score
    profile.creditScore = CreditScoreCalculator.calculateScore(profile);
    profile.creditGrade = CreditScoreCalculator.assignGrade(profile.creditScore);
    
    // Adjust quality coefficient using PID
    profile.qualityCoefficient = this.pidController.calculate(profile.avgEpsilon);
    
    // Record history
    this.recordScoreChange({
      agentAddress,
      previousScore,
      newScore: profile.creditScore,
      scoreDelta: profile.creditScore - previousScore,
      reason: 'Memory created',
      relatedNftId: nftId,
      timestamp: new Date(),
    });
    
    this.profiles.set(agentAddress, profile);
  }
  
  /**
   * Record memory sale
   */
  recordMemorySale(agentAddress: string, revenue: bigint, nftId: string): void {
    const profile = this.profiles.get(agentAddress);
    if (!profile) {
      throw new Error(`Agent profile not found: ${agentAddress}`);
    }
    
    const previousScore = profile.creditScore;
    
    // Update metrics
    profile.totalMemoriesSold++;
    profile.totalRevenue += revenue;
    profile.lastActivityAt = new Date();
    
    // Recalculate score
    profile.creditScore = CreditScoreCalculator.calculateScore(profile);
    profile.creditGrade = CreditScoreCalculator.assignGrade(profile.creditScore);
    
    // Record history
    this.recordScoreChange({
      agentAddress,
      previousScore,
      newScore: profile.creditScore,
      scoreDelta: profile.creditScore - previousScore,
      reason: 'Memory sold',
      relatedNftId: nftId,
      timestamp: new Date(),
    });
    
    this.profiles.set(agentAddress, profile);
  }
  
  /**
   * Record review
   */
  recordReview(agentAddress: string, isPositive: boolean, nftId: string): void {
    const profile = this.profiles.get(agentAddress);
    if (!profile) {
      throw new Error(`Agent profile not found: ${agentAddress}`);
    }
    
    const previousScore = profile.creditScore;
    
    // Update metrics
    if (isPositive) {
      profile.positiveReviews++;
    } else {
      profile.negativeReviews++;
    }
    
    // Recalculate score
    profile.creditScore = CreditScoreCalculator.calculateScore(profile);
    profile.creditGrade = CreditScoreCalculator.assignGrade(profile.creditScore);
    
    // Record history
    this.recordScoreChange({
      agentAddress,
      previousScore,
      newScore: profile.creditScore,
      scoreDelta: profile.creditScore - previousScore,
      reason: isPositive ? 'Positive review received' : 'Negative review received',
      relatedNftId: nftId,
      timestamp: new Date(),
    });
    
    this.profiles.set(agentAddress, profile);
  }
  
  /**
   * Get credit score history
   */
  getHistory(agentAddress: string): CreditScoreChange[] {
    return this.history.get(agentAddress) || [];
  }
  
  /**
   * Get leaderboard (top agents by credit score)
   */
  getLeaderboard(limit: number = 100): AgentCreditProfile[] {
    return Array.from(this.profiles.values())
      .sort((a, b) => b.creditScore - a.creditScore)
      .slice(0, limit);
  }
  
  /**
   * Get agents by grade
   */
  getAgentsByGrade(grade: CreditGrade): AgentCreditProfile[] {
    return Array.from(this.profiles.values())
      .filter(p => p.creditGrade === grade)
      .sort((a, b) => b.creditScore - a.creditScore);
  }
  
  /**
   * Record score change in history
   */
  private recordScoreChange(change: CreditScoreChange): void {
    const history = this.history.get(change.agentAddress) || [];
    history.push(change);
    this.history.set(change.agentAddress, history);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createCreditScoreManager(): CreditScoreManager {
  return new CreditScoreManager();
}

export function createQualityCoefficientController(
  kp?: number,
  ki?: number,
  kd?: number
): QualityCoefficientController {
  return new QualityCoefficientController(kp, ki, kd);
}
