import { getDb } from "./db";
import { blogPosts, type BlogPost, type InsertBlogPost } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";

/**
 * Create a new blog post
 */
export async function createBlogPost(data: InsertBlogPost): Promise<BlogPost> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(blogPosts).values(data);
  const insertId = Number((result as unknown as { insertId: number }[])[0]?.insertId || (result as unknown as { insertId: number }).insertId);
  return await getBlogPostById(insertId) as BlogPost;
}

/**
 * Update an existing blog post
 */
export async function updateBlogPost(id: number, data: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(blogPosts).set(data).where(eq(blogPosts.id, id));
  return await getBlogPostById(id);
}

/**
 * Delete a blog post
 */
export async function deleteBlogPost(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
}

/**
 * Get a blog post by ID
 */
export async function getBlogPostById(id: number): Promise<BlogPost | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
  return post;
}

/**
 * Get a blog post by slug
 */
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
  return post;
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { status, category, authorId, search, limit = 20, offset = 0 } = options;

  let query = db.select().from(blogPosts);

  const conditions = [];
  if (status) {
    conditions.push(eq(blogPosts.status, status));
  }
  if (category) {
    conditions.push(eq(blogPosts.category, category));
  }
  if (authorId) {
    conditions.push(eq(blogPosts.authorId, authorId));
  }
  if (search) {
    conditions.push(
      sql`(${blogPosts.title} LIKE ${`%${search}%`} OR ${blogPosts.excerpt} LIKE ${`%${search}%`})`
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const posts = await query
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
    .limit(limit)
    .offset(offset);

  return posts;
}

/**
 * Increment view count for a blog post
 */
export async function incrementBlogPostViews(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(blogPosts)
    .set({ viewCount: sql`${blogPosts.viewCount} + 1` })
    .where(eq(blogPosts.id, id));
}

/**
 * Get all blog categories
 */
export async function getBlogCategories(): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const results = await db
    .selectDistinct({ category: blogPosts.category })
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"));
  
  return results.map((r: { category: string | null }) => r.category).filter(Boolean) as string[];
}

/**
 * Get blog post count by status
 */
export async function getBlogPostCount(status?: "draft" | "published" | "archived"): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db.select({ count: sql<number>`count(*)` }).from(blogPosts);

  if (status) {
    query = query.where(eq(blogPosts.status, status)) as typeof query;
  }
  
  const [result] = await query;
  return result?.count || 0;
}
