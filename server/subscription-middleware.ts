import { TRPCError } from '@trpc/server';
import { getUserSubscription } from './db';

/**
 * Subscription status check middleware
 * Ensures user has an active subscription to access premium features
 */

export async function checkSubscriptionStatus(userId: number): Promise<{
  hasActiveSubscription: boolean;
  isPaidUser: boolean;
  isTrialing: boolean;
  plan: string | null;
}> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    return {
      hasActiveSubscription: false,
      isPaidUser: false,
      isTrialing: false,
      plan: null,
    };
  }

  const now = new Date();
  const isExpired = subscription.currentPeriodEnd && now > subscription.currentPeriodEnd;

  // Check if subscription is active
  const isActive = subscription.status === 'active' && !isExpired;
  const isTrialing = subscription.status === 'trialing' && !isExpired;

  // Paid users are those with active non-trial subscriptions
  const isPaidUser = isActive && subscription.plan !== 'free_trial' && subscription.plan !== 'FREE_TRIAL';

  return {
    hasActiveSubscription: isActive || isTrialing,
    isPaidUser,
    isTrialing,
    plan: subscription.plan,
  };
}

/**
 * Require active subscription (trial or paid)
 * Throws error if user doesn't have an active subscription
 */
export async function requireActiveSubscription(userId: number): Promise<void> {
  const status = await checkSubscriptionStatus(userId);

  if (!status.hasActiveSubscription) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This feature requires an active subscription. Please start your free trial or upgrade to a paid plan.',
    });
  }
}

/**
 * Require paid subscription (trial not allowed)
 * Throws error if user is on free trial or has no subscription
 */
export async function requirePaidSubscription(userId: number): Promise<void> {
  const status = await checkSubscriptionStatus(userId);

  if (!status.isPaidUser) {
    if (status.isTrialing) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This premium feature is only available to paid subscribers. Please upgrade your plan.',
      });
    } else {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This feature requires a paid subscription. Please upgrade your plan.',
      });
    }
  }
}

/**
 * Check if user can use IPFS storage
 * IPFS is only available to paid users (not trial)
 */
export async function canUseIPFS(userId: number): Promise<boolean> {
  const status = await checkSubscriptionStatus(userId);
  return status.isPaidUser;
}

/**
 * Check if user can use Arweave storage
 * Arweave is only available to yearly and lifetime subscribers
 */
export async function canUseArweave(userId: number): Promise<boolean> {
  const status = await checkSubscriptionStatus(userId);
  return status.isPaidUser && (
    status.plan === 'YEARLY' || 
    status.plan === 'LIFETIME' ||
    status.plan === 'yearly' ||
    status.plan === 'lifetime'
  );
}

/**
 * Get user's storage quota based on subscription plan
 */
export async function getStorageQuota(userId: number): Promise<{
  maxFileSize: number; // in bytes
  maxTotalStorage: number; // in bytes
  canUseIPFS: boolean;
  canUseArweave: boolean;
}> {
  const status = await checkSubscriptionStatus(userId);

  // Default quotas for free trial
  let maxFileSize = 10 * 1024 * 1024; // 10MB
  let maxTotalStorage = 1024 * 1024 * 1024; // 1GB

  if (status.isPaidUser) {
    // Paid users get higher quotas
    maxFileSize = 50 * 1024 * 1024; // 50MB
    maxTotalStorage = 10 * 1024 * 1024 * 1024; // 10GB

    // Lifetime users get unlimited storage
    if (status.plan === 'LIFETIME' || status.plan === 'lifetime') {
      maxTotalStorage = Infinity;
    }
  }

  return {
    maxFileSize,
    maxTotalStorage,
    canUseIPFS: await canUseIPFS(userId),
    canUseArweave: await canUseArweave(userId),
  };
}
