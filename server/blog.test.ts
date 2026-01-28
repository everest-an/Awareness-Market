import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as blogDb from "./blog-db";
import { getDb } from "./db";

describe("Blog System", () => {
  let testUserId: number;
  let testPostId: number;

  beforeAll(async () => {
    // Create a test admin user
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const { users } = await import("../drizzle/schema");
    const result = await db.insert(users).values({
      openId: "test-admin-blog-001",
      name: "Test Admin",
      email: "admin@blog-test.com",
      role: "admin",
    });
    testUserId = Number((result as unknown as { insertId: number }[])[0]?.insertId || (result as unknown as { insertId: number }).insertId);
  });

  afterAll(async () => {
    // Cleanup
    const db = await getDb();
    if (!db) return;

    const { users, blogPosts } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    
    await db.delete(blogPosts).where(eq(blogPosts.authorId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it("should create a blog post", async () => {
    const post = await blogDb.createBlogPost({
      title: "Test Blog Post",
      slug: "test-blog-post",
      excerpt: "This is a test excerpt",
      content: "# Test Content\n\nThis is test content.",
      authorId: testUserId,
      category: "Technology",
      tags: JSON.stringify(["test", "blog"]),
      status: "published",
      publishedAt: new Date(),
    });

    expect(post).toHaveProperty("id");
    expect(post.title).toBe("Test Blog Post");
    expect(post.slug).toBe("test-blog-post");

    testPostId = post.id;
  });

  it("should get blog post by ID", async () => {
    const post = await blogDb.getBlogPostById(testPostId);

    expect(post).toBeDefined();
    expect(post?.title).toBe("Test Blog Post");
    expect(post?.authorId).toBe(testUserId);
  });

  it("should get blog post by slug", async () => {
    const post = await blogDb.getBlogPostBySlug("test-blog-post");

    expect(post).toBeDefined();
    expect(post?.id).toBe(testPostId);
    expect(post?.slug).toBe("test-blog-post");
  });

  it("should list blog posts", async () => {
    const posts = await blogDb.listBlogPosts({
      status: "published",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
    
    const testPost = posts.find(p => p.id === testPostId);
    expect(testPost).toBeDefined();
  });

  it("should search blog posts", async () => {
    const posts = await blogDb.listBlogPosts({
      search: "Test",
      status: "published",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(posts)).toBe(true);
    const testPost = posts.find(p => p.id === testPostId);
    expect(testPost).toBeDefined();
  });

  it("should filter by category", async () => {
    const posts = await blogDb.listBlogPosts({
      category: "Technology",
      status: "published",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(posts)).toBe(true);
    const testPost = posts.find(p => p.id === testPostId);
    expect(testPost).toBeDefined();
  });

  it("should update blog post", async () => {
    const updated = await blogDb.updateBlogPost(testPostId, {
      title: "Updated Test Post",
      excerpt: "Updated excerpt",
    });

    expect(updated.title).toBe("Updated Test Post");
    expect(updated.excerpt).toBe("Updated excerpt");
  });

  it("should increment view count", async () => {
    const initialPost = await blogDb.getBlogPostById(testPostId);
    const initialViews = initialPost?.viewCount || 0;

    await blogDb.incrementBlogPostViews(testPostId);

    const updatedPost = await blogDb.getBlogPostById(testPostId);
    expect(updatedPost?.viewCount).toBe(initialViews + 1);
  });

  it("should get blog categories", async () => {
    const categories = await blogDb.getBlogCategories();

    expect(Array.isArray(categories)).toBe(true);
    expect(categories).toContain("Technology");
  });

  it("should get post count", async () => {
    const count = await blogDb.getBlogPostCount("published");

    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  it("should delete blog post", async () => {
    await blogDb.deleteBlogPost(testPostId);

     const deleted = await blogDb.getBlogPostById(testPostId);
    expect(deleted).toBeFalsy(); // null or undefined both mean deleted // null or undefined both mean deleted
  });
});
