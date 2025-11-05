import { z } from 'zod';
import { protectedProcedure, router } from './_core/trpc';
import { requirePaidSubscription, canUseIPFS } from './subscription-middleware';
import { uploadToIPFS, pinToIPFS, getFromIPFS, checkIPFSHealth } from './ipfs-storage';
import { updateFileR2Key } from './db';

/**
 * IPFS Storage Router
 * Premium feature for paid subscribers
 */
export const ipfsRouter = router({
  // Check IPFS service health
  health: protectedProcedure.query(async () => {
    const healthy = await checkIPFSHealth();
    return { healthy };
  }),

  // Upload file to IPFS (paid users only)
  upload: protectedProcedure
    .input(z.object({
      fileId: z.number(),
      fileName: z.string(),
      fileBuffer: z.string(), // base64 encoded
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user can use IPFS
      await requirePaidSubscription(ctx.user.id);
      
      const canUse = await canUseIPFS(ctx.user.id);
      if (!canUse) {
        throw new Error('IPFS storage is only available for paid subscribers');
      }

      // Decode base64 buffer
      const buffer = Buffer.from(input.fileBuffer, 'base64');

      // Upload to IPFS
      const { cid, url, size } = await uploadToIPFS(buffer, input.fileName);

      // Pin the file to ensure it stays available
      await pinToIPFS(cid);

      // Update file record with IPFS CID
      const { updateFileIPFSInfo } = await import('./db');
      await updateFileIPFSInfo(input.fileId, cid, url);

      return {
        success: true,
        cid,
        url,
        size,
        message: 'File uploaded to IPFS successfully',
      };
    }),

  // Get file from IPFS
  get: protectedProcedure
    .input(z.object({
      cid: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Check subscription
      await requirePaidSubscription(ctx.user.id);

      // Get file from IPFS
      const buffer = await getFromIPFS(input.cid);

      // Convert buffer to base64 for transmission
      const base64 = buffer.toString('base64');

      return {
        cid: input.cid,
        data: base64,
        size: buffer.length,
      };
    }),

  // Check if user can use IPFS
  canUse: protectedProcedure.query(async ({ ctx }) => {
    const can = await canUseIPFS(ctx.user.id);
    return { canUseIPFS: can };
  }),
});
