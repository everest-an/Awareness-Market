import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { subscriptionRouter } from "./subscription-router";
import { ipfsRouter } from "./ipfs-router";
import { z } from "zod";
import {
  getUserFiles,
  createFile,
  getUserDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  getUserTags,
  createTag,
  updateTag,
  deleteTag,
  addDocumentTag,
  getUserContacts,
  getContactById,
  createContact,
  updateContact,
  updateFileStatus,
  updateFileR2Key,
  getOrCreateCompany,
  updateCompanyInfo,
} from "./db";
import {
  checkSubscriptionStatus,
  requireActiveSubscription,
  getStorageQuota,
  canUseIPFS,
} from "./subscription-middleware";
import {
  performOCRFromFile,
  generateDocument as aiGenerateDocument,
  enrichCompanyInfo,
  extractKeywords,
  checkAIServiceHealth,
} from "./ai-client";
import { storagePut } from "./storage";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  
  // Health check endpoint
  health: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'awareness-network-api',
  })),
  subscription: subscriptionRouter,
  ipfs: ipfsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // File management routes
  files: router({
    list: protectedProcedure.query(({ ctx }) => getUserFiles(ctx.user.id)),
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        fileBuffer: z.string(), // base64 encoded
        useIPFS: z.boolean().optional().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check subscription status and storage quota
        await requireActiveSubscription(ctx.user.id);
        const quota = await getStorageQuota(ctx.user.id);
        
        // Check file size limit
        if (input.fileSize > quota.maxFileSize) {
          throw new Error(`File size exceeds limit. Maximum allowed: ${quota.maxFileSize / 1024 / 1024}MB`);
        }
        
        // Check if user can use IPFS
        if (input.useIPFS && !quota.canUseIPFS) {
          throw new Error('IPFS storage is only available for paid subscribers');
        }
        
        // Decode base64 buffer
        const buffer = Buffer.from(input.fileBuffer, 'base64');
        
        // Generate unique file key
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileKey = `users/${ctx.user.id}/files/${timestamp}-${randomSuffix}-${input.fileName}`;
        
        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, input.fileType);
        
        // Create file record
        const fileId = await createFile({
          userId: ctx.user.id,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
          r2ObjectKey: fileKey,
          status: 'uploading',
        });
        
        return { fileId, url };
      }),
  }),

  // Document management routes
  documents: router({
    list: protectedProcedure.query(({ ctx }) => getUserDocuments(ctx.user.id)),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getDocumentById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        sourceFileId: z.number().optional(),
        contentMd: z.string().optional(),
        summary: z.string().optional(),
        extractedText: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const docId = await createDocument({
          userId: ctx.user.id,
          ...input,
        });
        return { documentId: docId };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        contentMd: z.string().optional(),
        summary: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await updateDocument(id, updates);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDocument(input.id);
        return { success: true };
      }),
  }),

  // Tag management routes
  tags: router({
    list: protectedProcedure.query(({ ctx }) => getUserTags(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tagId = await createTag({
          userId: ctx.user.id,
          ...input,
        });
        return { tagId };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await updateTag(id, updates);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTag(input.id);
        return { success: true };
      }),
    addToDocument: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        tagId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await addDocumentTag(input.documentId, input.tagId);
        return { success: true };
      }),
  }),

  // Contact management routes
  contacts: router({
    list: protectedProcedure.query(({ ctx }) => getUserContacts(ctx.user.id)),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getContactById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        title: z.string().optional(),
        company: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        website: z.string().optional(),
        notes: z.string().optional(),
        sourceFileId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const contactId = await createContact({
          userId: ctx.user.id,
          ...input,
        });
        return { contactId };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        title: z.string().optional(),
        company: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await updateContact(id, updates);
        return { success: true };
      }),
  }),

  // AI processing routes
  ai: router({
    health: publicProcedure.query(async () => {
      const healthy = await checkAIServiceHealth();
      return { healthy };
    }),
    processImage: protectedProcedure
      .input(z.object({
        fileId: z.number(),
        fileBuffer: z.string(), // base64 encoded
        fileName: z.string(),
        autoGenerateDocument: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Decode base64 buffer
          const buffer = Buffer.from(input.fileBuffer, 'base64');
          
          // Perform OCR
          const ocrResult = await performOCRFromFile(buffer, input.fileName);
          
          // Update file status to processing
          await updateFileStatus(input.fileId, 'processing');
          
          let documentId: number | undefined;
          
          // Auto-generate document if requested
          if (input.autoGenerateDocument && ocrResult.extracted_text) {
            // Determine document type based on structured data
            const docType = ocrResult.structured_data ? 'business_card' : 'general';
            
            // Generate document
            const docResult = await aiGenerateDocument(
              ocrResult.extracted_text,
              docType
            );
            
            // Create document in database
            documentId = await createDocument({
              userId: ctx.user.id,
              sourceFileId: input.fileId,
              title: docResult.title,
              contentMd: docResult.content_md,
              summary: docResult.summary,
              extractedText: ocrResult.extracted_text,
              metadata: JSON.stringify(docResult.metadata),
            });
            
            // Create tags
            for (const tagName of docResult.tags) {
              const tagId = await createTag({
                userId: ctx.user.id,
                name: tagName,
              });
              await addDocumentTag(documentId, tagId);
            }
            
            // If it's a business card, create contact
            if (ocrResult.structured_data) {
              const contactData = ocrResult.structured_data;
              await createContact({
                userId: ctx.user.id,
                sourceFileId: input.fileId,
                name: contactData.name || 'Unknown',
                title: contactData.title,
                company: contactData.company,
                email: contactData.email,
                phone: contactData.phone,
                address: contactData.address,
                website: contactData.website,
              });
              
              // Enrich company info if company name exists
              if (contactData.company) {
                try {
                  const companyInfo = await enrichCompanyInfo(contactData.company);
                  const company = await getOrCreateCompany(contactData.company);
                  // Parse employee count string to number if possible
                  let employeeCount: number | undefined;
                  if (companyInfo.employee_count) {
                    const match = companyInfo.employee_count.match(/\d+/);
                    if (match) {
                      employeeCount = parseInt(match[0]);
                    }
                  }
                  
                  await updateCompanyInfo(contactData.company, {
                    industry: companyInfo.industry,
                    description: companyInfo.description,
                    website: companyInfo.website,
                    employeeCount,
                    foundedYear: companyInfo.founded_year,
                    headquarters: companyInfo.headquarters,
                  });
                } catch (err) {
                  console.error('Company enrichment failed:', err);
                }
              }
            }
          }
          
          // Update file status to completed
          await updateFileStatus(input.fileId, 'completed');
          
          return {
            success: true,
            ocrResult,
            documentId,
          };
        } catch (error) {
          // Update file status to error
          await updateFileStatus(input.fileId, 'error');
          throw error;
        }
      }),
  }),

  // TODO: add more feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
