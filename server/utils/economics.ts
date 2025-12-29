/**
 * Economics Utility Functions
 * Handles pricing, fees, and earnings calculations.
 */

export const PLATFORM_FEE_RATE = 0.20; // 20%

export interface TransactionBreakdown {
    amount: number;
    platformFee: number;
    creatorEarnings: number;
}

/**
 * Calculates the platform fee and creator earnings for a given transaction amount.
 * 
 * @param amount Total transaction amount (e.g. 100.00)
 * @returns Breakdown of fees
 */
export function calculateTransactionFees(amount: number): TransactionBreakdown {
    if (amount < 0) {
        throw new Error("Transaction amount cannot be negative");
    }

    // Fees are rounded to 2 decimal places to match currency standards
    const platformFee = Number((amount * PLATFORM_FEE_RATE).toFixed(2));
    const creatorEarnings = Number((amount - platformFee).toFixed(2));

    // Note: There might be a tiny penny difference due to rounding, 
    // but for this MVP we trust the split. In high-precision finance 
    // we would subtract fee from total to ensure exact sum match.

    return {
        amount,
        platformFee,
        creatorEarnings
    };
}
