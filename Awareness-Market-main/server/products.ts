/**
 * Stripe Products and Prices Configuration
 * Centralized product definitions for Awareness Network marketplace
 */

export interface SubscriptionProduct {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  features: string[];
  callLimit: number | null; // null = unlimited
}

export const SUBSCRIPTION_PRODUCTS: SubscriptionProduct[] = [
  {
    id: "basic",
    name: "Basic Plan",
    description: "Perfect for individuals exploring AI capabilities",
    priceMonthly: 29,
    priceYearly: 290, // ~17% discount
    features: [
      "100 API calls per month",
      "Access to all marketplace vectors",
      "Basic analytics dashboard",
      "Email support",
    ],
    callLimit: 100,
  },
  {
    id: "pro",
    name: "Professional Plan",
    description: "For professionals and small teams",
    priceMonthly: 99,
    priceYearly: 990, // ~17% discount
    features: [
      "1,000 API calls per month",
      "Priority access to new vectors",
      "Advanced analytics & insights",
      "Priority email support",
      "Custom integration assistance",
    ],
    callLimit: 1000,
  },
  {
    id: "enterprise",
    name: "Enterprise Plan",
    description: "For large teams and organizations",
    priceMonthly: 299,
    priceYearly: 2990, // ~17% discount
    features: [
      "Unlimited API calls",
      "Dedicated account manager",
      "Custom SLA agreements",
      "24/7 priority support",
      "White-label options",
      "Custom vector training",
    ],
    callLimit: null,
  },
];

/**
 * Platform fee rate for transactions (15-25%)
 * Applied to all vector purchases
 */
export const PLATFORM_FEE_RATE = 0.20; // 20%

/**
 * Minimum purchase amount in USD
 * Required by Stripe
 */
export const MINIMUM_PURCHASE_AMOUNT = 0.50;
