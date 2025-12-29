import { describe, it, expect } from 'vitest';
import { calculateTransactionFees } from '../utils/economics';

describe('Economics Logic', () => {
    it('should calculate 20% platform fee correctly', () => {
        const amount = 100.00;
        const result = calculateTransactionFees(amount);

        expect(result.amount).toBe(100.00);
        expect(result.platformFee).toBe(20.00);
        expect(result.creatorEarnings).toBe(80.00);
    });

    it('should handle small amounts', () => {
        const amount = 5.00;
        const result = calculateTransactionFees(amount);

        // 5 * 0.20 = 1.00
        expect(result.platformFee).toBe(1.00);
        expect(result.creatorEarnings).toBe(4.00);
    });

    it('should throw error for negative amounts', () => {
        expect(() => calculateTransactionFees(-10)).toThrow("Transaction amount cannot be negative");
    });

    it('should handle decimal rounding correctly', () => {
        const amount = 33.33;
        const result = calculateTransactionFees(amount);

        // 33.33 * 0.2 = 6.666 -> 6.67
        expect(result.platformFee).toBe(6.67);
        // 33.33 - 6.67 = 26.66
        expect(result.creatorEarnings).toBe(26.66);
    });
});
