import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCheckoutCompleted, handleSubscriptionUpdated, handleInvoicePaymentFailed } from '../stripe-webhook';
import * as db from '../db';
import { sendEmail } from '../_core/email';

// Mock DB
vi.mock('../db', () => ({
    createTransaction: vi.fn(),
    createNotification: vi.fn(),
    getUserById: vi.fn(),
    getSubscriptionPlans: vi.fn(),
    getUserSubscription: vi.fn(),
    createUserSubscription: vi.fn(),
    updateUserSubscription: vi.fn(),
}));

// Mock Email
vi.mock('../_core/email', () => ({
    sendEmail: vi.fn(),
}));

// Mock Stripe
vi.mock('../stripe-client', () => ({
    stripe: {
        customers: {
            retrieve: vi.fn(),
        },
        webhooks: {
            constructEvent: vi.fn(),
        },
    },
}));

import { stripe } from '../stripe-client';

describe('Payment Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleCheckoutCompleted (Vector Purchase)', () => {
        it('should create notification and send email on regular vector purchase', async () => {
            const session = {
                metadata: {
                    user_id: '1',
                    purchase_type: 'vector',
                    vector_id: '101'
                }
            };

            // Mock user lookup for email
            vi.mocked(db.getUserById).mockResolvedValue({ id: 1, email: 'user@example.com' } as any);

            await handleCheckoutCompleted(session);

            // Verify notification created
            expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
                userId: 1,
                type: 'transaction',
                relatedEntityId: 101,
            }));

            // Verify email sent
            expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'user@example.com',
                subject: expect.stringContaining('Purchase Successful'),
            }));
        });

        it('should silently ignore if metadata is missing', async () => {
            await handleCheckoutCompleted({});
            expect(db.createNotification).not.toHaveBeenCalled();
        });
    });

    describe('handleSubscriptionUpdated', () => {
        it('should update user subscription and notify', async () => {
            const subscription = {
                id: 'sub_123',
                customer: 'cus_123',
                status: 'active',
                current_period_start: 1700000000,
                current_period_end: 1702592000,
                items: { data: [{ price: { id: 'price_basic' } }] },
            };

            // Mock Stripe customer retrieval
            vi.mocked(stripe.customers.retrieve).mockResolvedValue({
                id: 'cus_123',
                deleted: false,
                metadata: { user_id: '1' }
            } as any);

            // Mock DB lookups
            vi.mocked(db.getSubscriptionPlans).mockResolvedValue([{ id: 1, stripePriceId: 'price_basic' }] as any);
            vi.mocked(db.getUserSubscription).mockResolvedValue({ id: 5 } as any); // existing sub
            vi.mocked(db.getUserById).mockResolvedValue({ id: 1, email: 'user@example.com' } as any);

            await handleSubscriptionUpdated(subscription);

            // Verify DB update
            expect(db.updateUserSubscription).toHaveBeenCalledWith(5, expect.objectContaining({
                status: 'active'
            }));

            // Verify notification
            expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
                type: 'subscription',
                title: 'Subscription Updated'
            }));
        });
    });

    describe('handleInvoicePaymentFailed', () => {
        it('should notify user of payment failure', async () => {
            const invoice = {
                customer: 'cus_fail',
            };

            vi.mocked(stripe.customers.retrieve).mockResolvedValue({
                id: 'cus_fail',
                metadata: { user_id: '2' }
            } as any);

            vi.mocked(db.getUserById).mockResolvedValue({ id: 2, email: 'fail@example.com' } as any);

            await handleInvoicePaymentFailed(invoice);

            expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Payment Failed'
            }));

            expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'fail@example.com'
            }));
        });
    });
});
