import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  subscriptions, 
  InsertSubscription,
  files,
  InsertFile,
  documents,
  InsertDocument,
  tags,
  InsertTag,
  documentTags,
  contacts,
  InsertContact,
  companies,
  InsertCompany
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Subscription queries
export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSubscription(data: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(subscriptions).values(data);
  return result;
}

export async function updateSubscription(id: number, data: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
}

export async function updateSubscriptionByStripeId(stripeSubscriptionId: string, data: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

// File queries
export async function createFile(data: InsertFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(files).values(data);
  // Return the last inserted file for this user
  const inserted = await db.select().from(files).where(eq(files.userId, data.userId)).orderBy(desc(files.id)).limit(1);
  return inserted[0]?.id || 0;
}

export async function getUserFiles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(files).where(eq(files.userId, userId)).orderBy(desc(files.createdAt));
}

export async function getFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(files).where(eq(files.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateFileStatus(fileId: number, status: 'uploading' | 'processing' | 'completed' | 'error') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(files)
    .set({ status })
    .where(eq(files.id, fileId));
}

export async function updateFileR2Key(fileId: number, r2ObjectKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(files)
    .set({ r2ObjectKey })
    .where(eq(files.id, fileId));
}

// Document queries
export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(documents).values(data);
  const inserted = await db.select().from(documents).where(eq(documents.userId, data.userId)).orderBy(desc(documents.id)).limit(1);
  return inserted[0]?.id || 0;
}

export async function getUserDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateDocument(id: number, data: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documents).set(data).where(eq(documents.id, id));
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(documents).where(eq(documents.id, id));
}

// Tag queries
export async function createTag(data: InsertTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(tags).values(data);
  const inserted = await db.select().from(tags).where(eq(tags.userId, data.userId)).orderBy(desc(tags.id)).limit(1);
  return inserted[0]?.id || 0;
}

export async function getUserTags(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tags).where(eq(tags.userId, userId));
}

export async function addDocumentTag(documentId: number, tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(documentTags).values({ documentId, tagId });
}

export async function getDocumentTags(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: tags.id,
    name: tags.name,
    color: tags.color,
  }).from(documentTags)
    .innerJoin(tags, eq(documentTags.tagId, tags.id))
    .where(eq(documentTags.documentId, documentId));
  return result;
}

// Contact queries
export async function createContact(data: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(contacts).values(data);
  const inserted = await db.select().from(contacts).where(eq(contacts.userId, data.userId)).orderBy(desc(contacts.id)).limit(1);
  return inserted[0]?.id || 0;
}

export async function getUserContacts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(contacts).where(eq(contacts.userId, userId)).orderBy(desc(contacts.createdAt));
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateContact(id: number, data: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts).set(data).where(eq(contacts.id, id));
}

// Company queries
export async function getOrCreateCompany(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(companies).where(eq(companies.name, name)).limit(1);
  if (existing.length > 0) return existing[0];
  
  await db.insert(companies).values({ name });
  const inserted = await db.select().from(companies).where(eq(companies.name, name)).limit(1);
  return inserted[0] || { id: 0, name };
}

export async function updateCompanyInfo(name: string, data: Partial<InsertCompany>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companies).set(data).where(eq(companies.name, name));
}


export async function updateFileIPFSInfo(fileId: number, ipfsCid: string, ipfsUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(files)
    .set({ 
      ipfsCid, 
      ipfsUrl,
      storageType: 'ipfs',
    })
    .where(eq(files.id, fileId));
}

export async function getFileStatus(fileId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
