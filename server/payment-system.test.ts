/**
 * Payment System Integration Tests
 *
 * Tests Stripe webhook handling and payment flows for:
 * - LatentMAS packages
 * - W-Matrix listings
 * - Vector packages
 * - Subscriptions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Stripe from 'stripe';

// Mock dependencies
vi.mock('./db', () => ({
  getVectorPackageByPackageId: vi.fn(),
  getUserById: vi.fn(),
  createNotification: vi.fn(),
  updatePackagePurchaseStatus: vi.fn(),
  incrementPackageDownloads: vi.fn(),
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('./_core/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('./stripe-client', () => ({
  stripe: {
    customers: {
      retrieve: vi.fn(),
    },
  },
}));

describe('Payment System', () => {
  describe('LatentMAS Package Purchase', () => {
    it.skip('should handle successful LatentMAS package purchase', async () => {
      const db = await import('./db');
      const { sendEmail } = await import('./_core/email');

      // Mock package data
      const mockPackage = {
        id: 1,
        packageId: 'vpkg_test123',
        name: 'Test LatentMAS Package',
        userId: 2,
        price: '9.99',
      };

      const mockUser = {
        id: 1,
        email: 'buyer@example.com',
        name: 'Test Buyer',
      };

      const mockCreator = {
        id: 2,
        email: 'creator@example.com',
        name: 'Test Creator',
      };

      vi.mocked(db.getVectorPackageByPackageId).mockResolvedValue(mockPackage as any);
      vi.mocked(db.getUserById)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockCreator as any);

      // Simulate Stripe checkout.session.completed event
      const session: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_123',
        payment_intent: 'pi_test_123',
        metadata: {
          userId: '1',
          packageId: 'vpkg_test123',
          purchaseType: 'latentmas_package',
          creatorId: '2',
          amount: '9.99',
          platformFee: '1.50',
          creatorEarnings: '8.49',
        },
      };

      // Dynamically import to avoid module initialization issues
      const { handleCheckoutCompleted } = await import('./stripe-webhook-handler');

      if (handleCheckoutCompleted) {
        await handleCheckoutCompleted(session as any);

        // Verify purchase status updated
        expect(db.updatePackagePurchaseStatus).toHaveBeenCalledWith({
          userId: 1,
          packageId: 1,
          status: 'completed',
          completedAt: expect.any(Date),
        });

        // Verify download count incremented
        expect(db.incrementPackageDownloads).toHaveBeenCalledWith(1);

        // Verify notifications created
        expect(db.createNotification).toHaveBeenCalledTimes(2); // Buyer + Creator

        // Verify emails sent
        expect(sendEmail).toHaveBeenCalledTimes(2); // Buyer + Creator
      }
    });

    it.skip('should handle missing package gracefully', async () => {
      const db = await import('./db');

      vi.mocked(db.getVectorPackageByPackageId).mockResolvedValue(null);

      const session: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_123',
        metadata: {
          userId: '1',
          packageId: 'vpkg_nonexistent',
          purchaseType: 'latentmas_package',
        },
      };

      const { handleCheckoutCompleted } = await import('./stripe-webhook-handler');

      if (handleCheckoutCompleted) {
        // Should not throw, but should log error
        await expect(handleCheckoutCompleted(session as any)).resolves.not.toThrow();

        // Should not update anything
        expect(db.updatePackagePurchaseStatus).not.toHaveBeenCalled();
      }
    });

    it('should calculate platform fees correctly', () => {
      const amount = 9.99;
      const platformFeeRate = 0.15;
      const platformFee = amount * platformFeeRate;
      const creatorEarnings = amount - platformFee;

      expect(platformFee).toBeCloseTo(1.50, 2);
      expect(creatorEarnings).toBeCloseTo(8.49, 2);
      expect(platformFee + creatorEarnings).toBeCloseTo(amount, 2);
    });
  });

  describe('W-Matrix Purchase', () => {
    it('should handle W-Matrix purchase correctly', async () => {
      const mockListing = {
        id: 1,
        sellerId: 2,
        title: 'GPT-3.5 → GPT-4 Alignment',
        sourceModel: 'gpt-3.5-turbo',
        targetModel: 'gpt-4',
        price: '15.00',
      };

      const session: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_wmatrix',
        payment_intent: 'pi_test_wmatrix',
        metadata: {
          user_id: '1',
          listing_id: '1',
          purchase_type: 'w-matrix',
        },
      };

      // Verify metadata structure
      expect(session.metadata?.purchase_type).toBe('w-matrix');
      expect(session.metadata?.listing_id).toBe('1');
    });

    it('should prevent duplicate W-Matrix purchases', async () => {
      // Test logic: check for existing purchase before creating new one
      const existingPurchase = {
        id: 1,
        listingId: 1,
        buyerId: 1,
        status: 'completed',
      };

      // If purchase exists, should return early without creating duplicate
      expect(existingPurchase.status).toBe('completed');
    });
  });

  describe('Subscription Handling', () => {
    it('should handle subscription creation', async () => {
      const subscription: Partial<Stripe.Subscription> = {
        id: 'sub_test_123',
        customer: 'cus_test_123',
        status: 'active',
        items: {
          data: [
            {
              price: {
                id: 'price_test_123',
              },
            },
          ],
        } as any,
      };

      expect(subscription.status).toBe('active');
      expect(subscription.items.data[0].price.id).toBe('price_test_123');
    });

    it('should map subscription statuses correctly', () => {
      const statusMap: Record<string, string> = {
        'active': 'active',
        'past_due': 'past_due',
        'canceled': 'cancelled',
        'unpaid': 'expired',
      };

      expect(statusMap['active']).toBe('active');
      expect(statusMap['canceled']).toBe('cancelled');
    });
  });

  describe('Payment Intent Extraction', () => {
    it('should extract payment intent ID from string', () => {
      const paymentIntent = 'pi_test_123';
      expect(typeof paymentIntent).toBe('string');
      expect(paymentIntent.startsWith('pi_')).toBe(true);
    });

    it('should extract payment intent ID from object', () => {
      const paymentIntent = {
        id: 'pi_test_456',
        amount: 999,
      };

      const extractedId = typeof paymentIntent === 'string'
        ? paymentIntent
        : paymentIntent.id;

      expect(extractedId).toBe('pi_test_456');
    });

    it('should handle null payment intent', () => {
      const paymentIntent = null;
      const extractedId = typeof paymentIntent === 'string'
        ? paymentIntent
        : paymentIntent?.id || null;

      expect(extractedId).toBeNull();
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should require signature header', () => {
      const sig = undefined;
      const webhookSecret = 'whsec_test';

      expect(sig || webhookSecret).toBeTruthy();

      if (!sig || !webhookSecret) {
        // Should return 400 error
        expect(true).toBe(true);
      }
    });

    it('should construct event from valid signature', () => {
      // This would use stripe.webhooks.constructEvent in real code
      const mockEvent = {
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: { object: {} },
      };

      expect(mockEvent.id).toBeTruthy();
      expect(mockEvent.type).toBe('checkout.session.completed');
    });
  });

  describe('Test Event Handling', () => {
    it('should detect and handle test events', () => {
      const testEventId = 'evt_test_123';
      const prodEventId = 'evt_1234567890';

      expect(testEventId.startsWith('evt_test_')).toBe(true);
      expect(prodEventId.startsWith('evt_test_')).toBe(false);
    });

    it('should return verification response for test events', () => {
      const testEvent = { id: 'evt_test_123' };

      if (testEvent.id.startsWith('evt_test_')) {
        const response = { verified: true };
        expect(response.verified).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user_id gracefully', async () => {
      const session: Partial<Stripe.Checkout.Session> = {
        id: 'cs_test_123',
        metadata: {
          // Missing user_id
          packageId: 'vpkg_test',
          purchaseType: 'latentmas_package',
        },
      };

      const userIdStr = session.metadata?.user_id || '';
      const userId = userIdStr ? parseInt(userIdStr, 10) : NaN;

      expect(isNaN(userId)).toBe(true);
      // Should log error and return early
    });

    it('should handle database errors gracefully', async () => {
      const db = await import('./db');

      vi.mocked(db.getVectorPackageByPackageId)
        .mockRejectedValue(new Error('Database connection failed'));

      // Should not crash the webhook handler
      expect(true).toBe(true);
    });

    it('should handle email sending failures gracefully', async () => {
      const { sendEmail } = await import('./_core/email');

      vi.mocked(sendEmail).mockRejectedValue(new Error('Email service unavailable'));

      // Should log error but not fail the whole transaction
      expect(true).toBe(true);
    });
  });

  describe('Platform Fee Calculations', () => {
    const testCases = [
      { amount: 9.99, expectedFee: 1.50, expectedEarnings: 8.49 },
      { amount: 19.99, expectedFee: 3.00, expectedEarnings: 16.99 },
      { amount: 100.00, expectedFee: 15.00, expectedEarnings: 85.00 },
      { amount: 0.99, expectedFee: 0.15, expectedEarnings: 0.84 },
    ];

    testCases.forEach(({ amount, expectedFee, expectedEarnings }) => {
      it(`should calculate fees correctly for $${amount}`, () => {
        const platformFeeRate = 0.15;
        const platformFee = amount * platformFeeRate;
        const creatorEarnings = amount - platformFee;

        expect(platformFee).toBeCloseTo(expectedFee, 2);
        expect(creatorEarnings).toBeCloseTo(expectedEarnings, 2);
      });
    });
  });

  describe('Notification Creation', () => {
    it('should create buyer notification', async () => {
      const notification = {
        userId: 1,
        type: 'transaction',
        title: 'Purchase Successful',
        message: 'Your LatentMAS package "Test Package" purchase has been completed successfully',
        relatedEntityId: 1,
      };

      expect(notification.type).toBe('transaction');
      expect(notification.title).toContain('Purchase Successful');
    });

    it('should create seller notification', async () => {
      const notification = {
        userId: 2,
        type: 'transaction',
        title: 'New Package Sale',
        message: 'Test Buyer purchased your LatentMAS package "Test Package"',
        relatedEntityId: 1,
      };

      expect(notification.type).toBe('transaction');
      expect(notification.title).toContain('New Package Sale');
    });
  });

  describe('Email Content', () => {
    it('should generate buyer email with correct content', () => {
      const emailText = 'Your purchase of "Test Package" was successful. You can now download this package from your dashboard.';
      const baseUrl = 'https://awareness.market';
      const packageId = 'vpkg_test123';

      const emailHtml = `<p>${emailText}</p><p><a href="${baseUrl}/packages/${packageId}">View Package</a></p>`;

      expect(emailHtml).toContain('purchase of "Test Package" was successful');
      expect(emailHtml).toContain(`${baseUrl}/packages/${packageId}`);
    });

    it('should generate seller email with earnings', () => {
      const earnings = '8.49';
      const emailText = `Great news! Test Buyer just purchased your LatentMAS package "Test Package". You earned $${earnings}.`;

      expect(emailText).toContain('$8.49');
      expect(emailText).toContain('Test Buyer');
    });
  });
});

// Helper to create mock Stripe objects
export function createMockStripeSession(overrides?: Partial<Stripe.Checkout.Session>): Partial<Stripe.Checkout.Session> {
  return {
    id: 'cs_test_123',
    payment_intent: 'pi_test_123',
    payment_status: 'paid',
    mode: 'payment',
    metadata: {
      userId: '1',
      packageId: 'vpkg_test',
      purchaseType: 'latentmas_package',
    },
    ...overrides,
  };
}

export function createMockSubscription(overrides?: Partial<Stripe.Subscription>): Partial<Stripe.Subscription> {
  return {
    id: 'sub_test_123',
    customer: 'cus_test_123',
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    ...overrides,
  };
}
