/**
 * Organization Analytics tRPC Router
 *
 * Endpoints for executive dashboard, billing, and report export.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { createOrgAnalytics } from '../analytics/org-analytics';
import { createBillingTracker } from '../analytics/billing-tracker';
import { createReportExporter } from '../analytics/report-exporter';
import { createOrgPlanCheckout } from '../stripe-client';

// Lazy singletons
let _analytics: ReturnType<typeof createOrgAnalytics> | null = null;
let _billing: ReturnType<typeof createBillingTracker> | null = null;
let _exporter: ReturnType<typeof createReportExporter> | null = null;

function getAnalytics() { return _analytics ??= createOrgAnalytics(prisma); }
function getBilling() { return _billing ??= createBillingTracker(prisma); }
function getExporter() { return _exporter ??= createReportExporter(prisma); }

export const orgAnalyticsRouter = router({
  // ---- Overview ----

  /** Get comprehensive org overview stats */
  overview: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return getAnalytics().getOverview(input.orgId);
    }),

  /** Get memory health metrics */
  memoryHealth: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return getAnalytics().getMemoryHealth(input.orgId);
    }),

  /** Get agent leaderboard */
  agentLeaderboard: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return getAnalytics().getAgentLeaderboard(input.orgId, input.limit);
    }),

  /** Get department productivity stats */
  departmentStats: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return getAnalytics().getDepartmentStats(input.orgId);
    }),

  /** Get decision accuracy trend */
  decisionTrend: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      days: z.number().min(1).max(365).default(30),
    }))
    .query(async ({ input }) => {
      return getAnalytics().getDecisionTrend(input.orgId, input.days);
    }),

  /** Get memory creation activity */
  memoryActivity: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      days: z.number().min(1).max(365).default(30),
    }))
    .query(async ({ input }) => {
      return getAnalytics().getMemoryActivity(input.orgId, input.days);
    }),

  // ---- Billing ----

  /** Get billing/usage overview */
  billingOverview: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return getBilling().getUsageOverview(input.orgId);
    }),

  /** Check usage limit warnings */
  limitWarnings: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return getBilling().checkLimits(input.orgId);
    }),

  /** Get available upgrade options */
  upgradeOptions: protectedProcedure
    .input(z.object({ currentTier: z.string() }))
    .query(async ({ input }) => {
      return getBilling().getUpgradeOptions(input.currentTier);
    }),

  // ---- Export ----

  /** Export decisions as CSV */
  exportDecisions: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      agentId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(10000).default(1000),
    }))
    .mutation(async ({ input }) => {
      const csv = await getExporter().exportDecisionsCSV(input.orgId, {
        agentId: input.agentId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        limit: input.limit,
      });
      return { csv, filename: `decisions-${input.orgId}-${new Date().toISOString().split('T')[0]}.csv` };
    }),

  /** Export reputation report as CSV */
  exportReputation: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .mutation(async ({ input }) => {
      const csv = await getExporter().exportReputationCSV(input.orgId);
      return { csv, filename: `reputation-${input.orgId}-${new Date().toISOString().split('T')[0]}.csv` };
    }),

  /** Export memory health as CSV */
  exportMemoryHealth: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      limit: z.number().min(1).max(10000).default(5000),
    }))
    .mutation(async ({ input }) => {
      const csv = await getExporter().exportMemoryHealthCSV(input.orgId, input.limit);
      return { csv, filename: `memory-health-${input.orgId}-${new Date().toISOString().split('T')[0]}.csv` };
    }),

  // ---- Stripe Plan Checkout ----

  /** Create a Stripe checkout session for org plan upgrade */
  createCheckoutSession: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      targetTier: z.enum(['lite', 'team', 'enterprise', 'scientific']),
    }))
    .mutation(async ({ input, ctx }) => {
      const PLAN_PRICES: Record<string, number> = {
        lite: 49, team: 199, enterprise: 499, scientific: 999,
      };

      const org = await prisma.organization.findUnique({ where: { id: input.orgId } });
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });

      const currentTierIndex = ['lite', 'team', 'enterprise', 'scientific'].indexOf(org.planTier);
      const targetTierIndex = ['lite', 'team', 'enterprise', 'scientific'].indexOf(input.targetTier);
      if (targetTierIndex <= currentTierIndex) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only upgrade to a higher tier' });
      }

      const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      if (!user?.email) throw new TRPCError({ code: 'BAD_REQUEST', message: 'User email required for checkout' });

      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const checkoutUrl = await createOrgPlanCheckout({
        userId: ctx.user.id,
        userEmail: user.email,
        userName: user.name || undefined,
        orgId: input.orgId,
        targetTier: input.targetTier,
        priceMonthly: PLAN_PRICES[input.targetTier],
        successUrl: `${baseUrl}/org/billing?orgId=${input.orgId}&upgraded=true`,
        cancelUrl: `${baseUrl}/org/billing?orgId=${input.orgId}`,
      });

      return { checkoutUrl };
    }),
});
