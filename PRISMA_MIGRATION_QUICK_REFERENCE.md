# Prisma 迁移快速参考指南

## 常用操作对照表

### 1. 查询单条记录

#### Drizzle
```typescript
const result = await db.select()
  .from(users)
  .where(eq(users.id, id))
  .limit(1);
const user = result[0];
```

#### Prisma
```typescript
const user = await prisma.user.findUnique({
  where: { id }
});
```

---

### 2. 查询多条记录

#### Drizzle
```typescript
const results = await db.select()
  .from(users)
  .where(eq(users.role, 'admin'));
```

#### Prisma
```typescript
const results = await prisma.user.findMany({
  where: { role: 'admin' }
});
```

---

### 3. 带关系的查询（JOIN）

#### Drizzle
```typescript
const results = await db.select()
  .from(reviews)
  .leftJoin(users, eq(reviews.userId, users.id))
  .where(eq(reviews.vectorId, vectorId));
```

#### Prisma
```typescript
const results = await prisma.review.findMany({
  where: { vectorId },
  include: {
    user: true
  }
});
```

---

### 4. 创建记录（简单）

#### Drizzle
```typescript
await db.insert(users).values({
  name: 'John',
  email: 'john@example.com'
});
```

#### Prisma
```typescript
await prisma.user.create({
  data: {
    name: 'John',
    email: 'john@example.com'
  }
});
```

---

### 5. 创建记录（带关系）

#### Drizzle
```typescript
await db.insert(reviews).values({
  userId: 1,
  vectorId: 2,
  rating: 5
});
```

#### Prisma
```typescript
await prisma.review.create({
  data: {
    user: { connect: { id: 1 } },
    vector: { connect: { id: 2 } },
    rating: 5
  }
});
```

---

### 6. 更新记录

#### Drizzle
```typescript
await db.update(users)
  .set({ name: 'Jane' })
  .where(eq(users.id, id));
```

#### Prisma
```typescript
await prisma.user.update({
  where: { id },
  data: { name: 'Jane' }
});
```

---

### 7. 增量操作

#### Drizzle
```typescript
await db.update(vectors)
  .set({ totalCalls: sql`${vectors.totalCalls} + 1` })
  .where(eq(vectors.id, id));
```

#### Prisma
```typescript
await prisma.latentVector.update({
  where: { id },
  data: {
    totalCalls: { increment: 1 }
  }
});
```

---

### 8. 删除记录

#### Drizzle
```typescript
await db.delete(users)
  .where(eq(users.id, id));
```

#### Prisma
```typescript
await prisma.user.delete({
  where: { id }
});
```

---

### 9. Upsert 操作

#### Drizzle
```typescript
const existing = await getUser(id);
if (existing) {
  await db.update(users).set(data).where(eq(users.id, id));
} else {
  await db.insert(users).values(data);
}
```

#### Prisma
```typescript
await prisma.user.upsert({
  where: { id },
  create: createData,
  update: updateData
});
```

---

### 10. 聚合查询

#### Drizzle
```typescript
const result = await db.select({
  count: sql<number>`COUNT(*)`,
  avg: sql<number>`AVG(rating)`
}).from(reviews);
```

#### Prisma
```typescript
const result = await prisma.review.aggregate({
  _count: true,
  _avg: {
    rating: true
  }
});
```

---

### 11. 原始 SQL 查询

#### Drizzle
```typescript
const rows = await db.execute(sql`
  SELECT * FROM users WHERE name LIKE ${pattern}
`);
```

#### Prisma
```typescript
const rows = await prisma.$queryRaw<User[]>`
  SELECT * FROM users WHERE name LIKE ${pattern}
`;
```

---

### 12. 排序和分页

#### Drizzle
```typescript
await db.select()
  .from(users)
  .orderBy(desc(users.createdAt))
  .limit(10)
  .offset(20);
```

#### Prisma
```typescript
await prisma.user.findMany({
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 20
});
```

---

### 13. 复杂条件查询

#### Drizzle
```typescript
await db.select()
  .from(users)
  .where(
    and(
      eq(users.role, 'admin'),
      or(
        eq(users.status, 'active'),
        eq(users.status, 'pending')
      )
    )
  );
```

#### Prisma
```typescript
await prisma.user.findMany({
  where: {
    role: 'admin',
    OR: [
      { status: 'active' },
      { status: 'pending' }
    ]
  }
});
```

---

### 14. 范围查询

#### Drizzle
```typescript
await db.select()
  .from(transactions)
  .where(
    and(
      gte(transactions.createdAt, startDate),
      lte(transactions.createdAt, endDate)
    )
  );
```

#### Prisma
```typescript
await prisma.transaction.findMany({
  where: {
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  }
});
```

---

### 15. 模糊搜索

#### Drizzle
```typescript
await db.select()
  .from(vectors)
  .where(like(vectors.title, `%${keyword}%`));
```

#### Prisma
```typescript
await prisma.latentVector.findMany({
  where: {
    title: {
      contains: keyword,
      mode: 'insensitive' // 不区分大小写
    }
  }
});
```

---

## 常见模式

### 错误处理模板
```typescript
export async function myFunction(params) {
  try {
    const result = await prisma.model.operation({
      // ... 操作参数
    });
    return result;
  } catch (error) {
    logger.error('Failed to perform operation', { error, params });
    return undefined; // 或 throw error
  }
}
```

### 关系查询选择特定字段
```typescript
const result = await prisma.review.findMany({
  where: { vectorId },
  include: {
    user: {
      select: {
        name: true,
        avatar: true
      }
    }
  }
});
```

### 批量更新
```typescript
await prisma.user.updateMany({
  where: { role: 'user' },
  data: { status: 'active' }
});
```

---

## Prisma 独有功能

### 事务
```typescript
await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.notification.create({ data: notificationData })
]);
```

### 交互式事务
```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  await tx.notification.create({
    data: { userId: user.id, message: 'Welcome!' }
  });
});
```

### 连接验证
```typescript
await prisma.$connect();
await prisma.$disconnect();
```

---

## 常见陷阱

### ❌ 错误：直接传递 ID
```typescript
// 错误
await prisma.review.create({
  data: {
    userId: 1,
    vectorId: 2
  }
});
```

### ✅ 正确：使用关系连接
```typescript
// 正确
await prisma.review.create({
  data: {
    user: { connect: { id: 1 } },
    vector: { connect: { id: 2 } }
  }
});
```

---

## 性能优化提示

1. **使用 select 减少数据传输**
```typescript
await prisma.user.findMany({
  select: { id: true, name: true }
});
```

2. **使用 include 预加载关系**
```typescript
await prisma.user.findMany({
  include: { reviews: true }
});
```

3. **批量操作**
```typescript
await prisma.user.createMany({
  data: [user1, user2, user3]
});
```

4. **使用索引**
确保 Prisma Schema 中定义了适当的索引：
```prisma
@@index([userId])
@@index([createdAt])
```

---

## 调试技巧

### 启用查询日志
```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});
```

### 查看生成的 SQL
```typescript
// 使用 Prisma Studio
npx prisma studio

// 或在代码中
console.log(await prisma.$queryRaw`SELECT 1`);
```

---

## 有用的命令

```bash
# 生成 Prisma Client
npx prisma generate

# 查看数据库 Studio
npx prisma studio

# 格式化 schema
npx prisma format

# 验证 schema
npx prisma validate

# 创建迁移
npx prisma migrate dev --name description

# 应用迁移
npx prisma migrate deploy
```

---

**最后更新**: 2026-02-01
**Prisma 版本**: 6.19.2
