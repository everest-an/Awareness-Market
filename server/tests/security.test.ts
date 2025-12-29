import { describe, it, expect } from 'vitest';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';

// Mock Context
const createMockContext = (role: 'user' | 'admin' | 'creator' | null) => ({
    user: role ? { id: 1, role, email: 'test@example.com' } : null,
});

// Mock Router for Testing
const testRouter = router({
    public: publicProcedure.query(() => 'public data'),
    protected: protectedProcedure.query(() => 'protected data'),
    adminOnly: protectedProcedure.use(({ ctx, next }) => {
        if (ctx.user?.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return next({ ctx });
    }).query(() => 'secret admin data'),
});

describe('Security Access Control', () => {
    it('should allow public access to public procedures', async () => {
        const caller = testRouter.createCaller(createMockContext(null));
        const result = await caller.public();
        expect(result).toBe('public data');
    });

    it('should deny unauthorized access to protected procedures', async () => {
        const caller = testRouter.createCaller(createMockContext(null));

        try {
            await caller.protected();
            throw new Error('Should have thrown');
        } catch (e: any) {
            expect(e.code).toBe('UNAUTHORIZED');
        }
    });

    it('should allow authorized access to protected procedures', async () => {
        const caller = testRouter.createCaller(createMockContext('user'));
        const result = await caller.protected();
        expect(result).toBe('protected data');
    });

    it('should deny non-admin access to admin procedures', async () => {
        const caller = testRouter.createCaller(createMockContext('user'));

        try {
            await caller.adminOnly();
            throw new Error('Should have thrown');
        } catch (e: any) {
            expect(e.code).toBe('FORBIDDEN');
        }
    });

    it('should allow admin access to admin procedures', async () => {
        const caller = testRouter.createCaller(createMockContext('admin'));
        const result = await caller.adminOnly();
        expect(result).toBe('secret admin data');
    });
});
