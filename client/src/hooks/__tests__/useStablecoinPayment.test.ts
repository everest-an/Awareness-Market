/**
 * Unit tests for the pure helper functions in useStablecoinPayment.ts
 *
 * We test `classifyError` in isolation without mounting a React component.
 * Hook integration tests would live in a separate Vitest + @testing-library file.
 */

import { describe, it, expect } from 'vitest';
import { classifyError } from '../useStablecoinPayment';

describe('classifyError', () => {
  it('classifies MetaMask rejection', () => {
    const result = classifyError('MetaMask Tx Signature: User denied transaction signature.');
    expect(result).toContain('rejected');
  });

  it('classifies user rejected (ethers phrasing)', () => {
    const result = classifyError('user rejected action');
    expect(result).toContain('rejected');
  });

  it('classifies insufficient balance', () => {
    const result = classifyError('Insufficient USDC balance. Need 50.00, have 10.00');
    expect(result.toLowerCase()).toContain('balance');
  });

  it('classifies spending limit exceeded', () => {
    const result = classifyError('Amount $200 exceeds per-transaction limit of $100');
    expect(result.toLowerCase()).toContain('limit');
  });

  it('classifies network / RPC errors', () => {
    const result = classifyError('could not detect network');
    expect(result.toLowerCase()).toContain('network');
  });

  it('classifies RPC timeout', () => {
    const result = classifyError('Request timed out after 30000ms');
    expect(result.toLowerCase()).toContain('network');
  });

  it('passes through unclassified errors unchanged', () => {
    const raw = 'execution reverted: Package already purchased';
    const result = classifyError(raw);
    expect(result).toBe(raw);
  });

  it('is case-insensitive for pattern matching', () => {
    const result = classifyError('USER REJECTED the transaction');
    expect(result).toContain('rejected');
  });
});
