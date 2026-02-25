import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import * as blogDb from "../blog-db";
import type { BlogPostData } from "../types/router-types";

export const blogRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.enum(["draft", "published", "archived"]).optional(),
      category: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const status = input.status || "published";
      return await blogDb.listBlogPosts({ ...input, status });
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const post = await blogDb.getBlogPostBySlug(input.slug);
      if (post && post.status === "published") {
        await blogDb.incrementBlogPostViews(post.id);
      }
      return post;
    }),

  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await blogDb.getBlogPostById(input.id);
    }),

  create: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      slug: z.string().min(1),
      excerpt: z.string().optional(),
      content: z.string().min(1),
      coverImage: z.string().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional(),
      status: z.enum(["draft", "published", "archived"]).default("draft"),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: BlogPostData = {
        ...input,
        authorId: ctx.user.id,
        tags: input.tags ? JSON.stringify(input.tags) : undefined,
        publishedAt: input.status === "published" ? new Date() : undefined,
      };
      return await blogDb.createBlogPost(data as any);
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      slug: z.string().optional(),
      excerpt: z.string().optional(),
      content: z.string().optional(),
      coverImage: z.string().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const data: Record<string, unknown> = { ...updates };
      if (updates.tags) {
        data.tags = JSON.stringify(updates.tags);
      }
      if (updates.status === "published") {
        const existing = await blogDb.getBlogPostById(id);
        if (existing && !existing.publishedAt) {
          data.publishedAt = new Date();
        }
      }
      return await blogDb.updateBlogPost(id, data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await blogDb.deleteBlogPost(input.id);
      return { success: true };
    }),

  getCategories: publicProcedure.query(async () => {
    return await blogDb.getBlogCategories();
  }),

  getCount: adminProcedure
    .input(z.object({ status: z.enum(["draft", "published", "archived"]).optional() }))
    .query(async ({ input }) => {
      return await blogDb.getBlogPostCount(input.status);
    }),
});
