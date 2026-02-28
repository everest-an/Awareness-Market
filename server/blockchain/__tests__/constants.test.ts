/**
 * Unit tests for blockchain/constants.ts
 *
 * Validates that derived constants stay in sync with their source values,
 * and that critical addresses are valid Ethereum-format hex strings.
 */

import { describe, it, expect } from 'vitest';
import {
  PLATFORM_FEE_BPS,
  PLATFORM_FEE_RATE,
  STABLECOIN_ADDRESSES,
  STABLECOIN_DECIMALS,
  DEFAULT_DAILY_SPEND_LIMIT_USD,
  DEFAULT_PER_TX_SPEND_LIMIT_USD,
  QUOTE_TTL_SECONDS,
} from '../constants';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

describe('Fee constants', () => {
  it('PLATFORM_FEE_RATE is derived from PLATFORM_FEE_BPS', () => {
    expect(PLATFORM_FEE_RATE).toBeCloseTo(PLATFORM_FEE_BPS / 10_000, 10);
  });

  it('5% fee rate equals 500 bps', () => {
    expect(PLATFORM_FEE_BPS).toBe(500);
    expect(PLATFORM_FEE_RATE).toBe(0.05);
  });

  it('platform fee of 5% on $100 equals $5', () => {
    expect(100 * PLATFORM_FEE_RATE).toBe(5);
  });

  it('seller receives 95% after 5% fee', () => {
    const price = 100;
    const fee = price * PLATFORM_FEE_RATE;
    const sellerReceives = price - fee;
    expect(sellerReceives).toBe(95);
  });
});

describe('Stablecoin addresses', () => {
  it('mainnet USDC is a valid Ethereum address', () => {
    expect(STABLECOIN_ADDRESSES.mainnet.USDC).toMatch(ETH_ADDRESS_RE);
  });

  it('mainnet USDT is a valid Ethereum address', () => {
    expect(STABLECOIN_ADDRESSES.mainnet.USDT).toMatch(ETH_ADDRESS_RE);
  });

  it('USDC and USDT mainnet addresses are distinct', () => {
    expect(STABLECOIN_ADDRESSES.mainnet.USDC).not.toBe(STABLECOIN_ADDRESSES.mainnet.USDT);
  });

  it('stablecoin decimals is 6 (standard for USDC/USDT on Avalanche)', () => {
    expect(STABLECOIN_DECIMALS).toBe(6);
  });
});

describe('Spending limit defaults', () => {
  it('daily limit is higher than per-tx limit', () => {
    expect(DEFAULT_DAILY_SPEND_LIMIT_USD).toBeGreaterThan(DEFAULT_PER_TX_SPEND_LIMIT_USD);
  });

  it('per-tx limit is positive', () => {
    expect(DEFAULT_PER_TX_SPEND_LIMIT_USD).toBeGreaterThan(0);
  });
});

describe('Quote TTL', () => {
  it('quote is valid for 5 minutes (300 seconds)', () => {
    expect(QUOTE_TTL_SECONDS).toBe(300);
  });
});
