import { prisma } from "./db-prisma";
import type { BlogPost, Prisma } from "@prisma/client";

type InsertBlogPost = Prisma.BlogPostCreateInput;

/**
 * Create a new blog post
 */
export async function createBlogPost(data: InsertBlogPost): Promise<BlogPost> {
  return await prisma.blogPost.create({ data });
}

/**
 * Update an existing blog post
 */
export async function updateBlogPost(id: number, data: Partial<InsertBlogPost>): Promise<BlogPost | null> {
  return await prisma.blogPost.update({
    where: { id },
    data
  });
}

/**
 * Delete a blog post
 */
export async function deleteBlogPost(id: number): Promise<void> {
  await prisma.blogPost.delete({ where: { id } });
}

/**
 * Get a blog post by ID
 */
export async function getBlogPostById(id: number): Promise<BlogPost | null> {
  return await prisma.blogPost.findUnique({ where: { id } });
}

/**
 * Get a blog post by slug
 */
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  return await prisma.blogPost.findFirst({ where: { slug } });
}

/**
 * List blog posts with filters
 */
export async function listBlogPosts(options: {
  status?: "draft" | "published" | "archived";
  category?: string;
  authorId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<BlogPost[]> {
  const { status, category, authorId, search, limit = 20, offset = 0 } = options;

  const where: Prisma.BlogPostWhereInput = {};

  if (status) {
    where.status = status;
  }
  if (category) {
    where.category = category;
  }
  if (authorId) {
    where.authorId = authorId;
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { excerpt: { contains: search, mode: 'insensitive' } }
    ];
  }

  return await prisma.blogPost.findMany({
    where,
    orderBy: [
      { publishedAt: 'desc' },
      { createdAt: 'desc' }
    ],
    take: limit,
    skip: offset
  });
}

/**
 * Increment view count for a blog post
 */
export async function incrementBlogPostViews(id: number): Promise<void> {
  await prisma.blogPost.update({
    where: { id },
    data: { viewCount: { increment: 1 } }
  });
}

/**
 * Get all blog categories
 */
export async function getBlogCategories(): Promise<string[]> {
  const results = await prisma.blogPost.findMany({
    where: { status: "published" },
    select: { category: true },
    distinct: ['category']
  });

  return results.map(r => r.category).filter(Boolean) as string[];
}

/**
 * Get blog post count by status
 */
export async function getBlogPostCount(status?: "draft" | "published" | "archived"): Promise<number> {
  const where: Prisma.BlogPostWhereInput = {};

  if (status) {
    where.status = status;
  }

  return await prisma.blogPost.count({ where });
}
