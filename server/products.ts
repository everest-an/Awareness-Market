/**
 * Subscription products and pricing for Awareness Network 2.0
 */

export const SUBSCRIPTION_PLANS = {
  FREE_TRIAL: {
    id: 'free_trial',
    name: 'Free Trial',
    description: '15-day free trial with full access',
    price: 0,
    duration: 15, // days
    features: [
      'Unlimited OCR processing',
      'AI document generation',
      'Company information lookup',
      'Basic storage (R2)',
      'Web and mobile access',
    ],
  },
  MONTHLY: {
    id: 'monthly',
    name: 'Monthly Subscription',
    description: 'Full access with monthly billing',
    price: 9.99, // USD
    priceId: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder',
    currency: 'usd',
    interval: 'month',
    features: [
      'Unlimited OCR processing',
      'AI document generation',
      'Company information lookup',
      'Advanced storage (R2)',
      'Web and mobile access',
      'Priority support',
    ],
  },
  YEARLY: {
    id: 'yearly',
    name: 'Yearly Subscription',
    description: 'Full access with yearly billing (save 20%)',
    price: 95.99, // USD (20% discount)
    priceId: process.env.STRIPE_PRICE_YEARLY || 'price_yearly_placeholder',
    currency: 'usd',
    interval: 'year',
    features: [
      'Unlimited OCR processing',
      'AI document generation',
      'Company information lookup',
      'Advanced storage (R2)',
      'IPFS distributed storage',
      'Web and mobile access',
      'Priority support',
      'Early access to new features',
    ],
  },
  LIFETIME: {
    id: 'lifetime',
    name: 'Lifetime Access',
    description: 'One-time payment for lifetime access',
    price: 299.99, // USD
    priceId: process.env.STRIPE_PRICE_LIFETIME || 'price_lifetime_placeholder',
    currency: 'usd',
    interval: 'one_time',
    features: [
      'Unlimited OCR processing',
      'AI document generation',
      'Company information lookup',
      'Advanced storage (R2)',
      'IPFS distributed storage',
      'Arweave permanent storage',
      'Web and mobile access',
      'Priority support',
      'Lifetime updates',
    ],
  },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

/**
 * Web3 payment options (USDT on Ethereum/Polygon)
 */
export const WEB3_PAYMENT = {
  MONTHLY_USDT: {
    amount: 10, // USDT
    contract: process.env.USDT_CONTRACT_ADDRESS || '0xdac17f958d2ee523a2206206994597c13d831ec7', // Ethereum mainnet USDT
    chainId: 1, // Ethereum mainnet
  },
  YEARLY_USDT: {
    amount: 96, // USDT
    contract: process.env.USDT_CONTRACT_ADDRESS || '0xdac17f958d2ee523a2206206994597c13d831ec7',
    chainId: 1,
  },
  LIFETIME_USDT: {
    amount: 300, // USDT
    contract: process.env.USDT_CONTRACT_ADDRESS || '0xdac17f958d2ee523a2206206994597c13d831ec7',
    chainId: 1,
  },
} as const;
