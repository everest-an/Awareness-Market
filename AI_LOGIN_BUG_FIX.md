# AI Agent 登录后仍显示未登录状态 - Bug修复

## 🐛 问题描述

用户报告：AI Agent通过ERC-8004登录后，界面仍然显示未登录状态，无法发布产品、无法开始交互。

---

## 🔍 问题根源

### 问题分析

#### 1. AI Agent登录流程（AgentAuth.tsx）

```typescript
// client/src/pages/AgentAuth.tsx:151
// 登录成功后，将token存储到localStorage
localStorage.setItem("erc8004_token", result.token!);

// 然后重定向到首页
setTimeout(() => setLocation("/"), 2000);
```

**问题**：Token存储在`localStorage`中，key为`erc8004_token`

---

#### 2. 认证状态检查（useAuth hook）

```typescript
// client/src/hooks/useAuth.ts:16-19
const meQuery = trpc.auth.me.useQuery(undefined, {
  retry: false,
  refetchOnWindowFocus: false,
});

// client/src/hooks/useAuth.ts:53
isAuthenticated: Boolean(meQuery.data),
```

**问题**：依赖`trpc.auth.me`查询结果来判断是否登录

---

#### 3. 后端认证检查（server/_core/sdk.ts）

```typescript
// server/_core/sdk.ts:261-276
async authenticateRequest(req: Request): Promise<User> {
  const cookies = this.parseCookies(req.headers.cookie);

  // 只检查cookies中的jwt_token
  const jwtToken = cookies.get('jwt_token');
  if (jwtToken) {
    // 验证JWT token
  }

  // Fallback到Manus OAuth session
  const sessionCookie = cookies.get(COOKIE_NAME);
  // ...
}
```

**核心问题**：
- ✅ 前端：Token存储在`localStorage['erc8004_token']`
- ❌ 后端：只检查`cookies['jwt_token']`和`cookies['manus_session']`
- ❌ **localStorage无法被后端访问**（因为它是客户端存储）

**结果**：后端无法识别AI Agent的登录状态，返回null，前端显示未登录。

---

## ✅ 解决方案

### 方案1：统一JWT Token认证（推荐）

修改AI Agent登录流程，使其与普通用户登录使用相同的JWT token机制。

#### Step 1: 修改后端 - 添加AI Agent token转换API

在`server/routers/auth-unified.ts`添加新endpoint：

```typescript
/**
 * Convert ERC-8004 authentication to JWT session
 */
convertAgentToken: publicProcedure
  .input(z.object({
    erc8004Token: z.string(),
  }))
  .mutation(async ({ input, ctx }) => {
    // 验证ERC-8004 token
    const agentAuth = await import('../auth-ai-agent');
    const agentResult = await agentAuth.verifyERC8004Token(input.erc8004Token);

    if (!agentResult.success || !agentResult.agent) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid ERC-8004 token',
      });
    }

    // 从AI Agent创建或获取User记录
    const authStandalone = await import('../auth-standalone');
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { openId: `agent:${agentResult.agent.agentId}` },
          { email: agentResult.agent.walletAddress }
        ]
      }
    });

    if (!user) {
      // 创建新User记录
      user = await prisma.user.create({
        data: {
          openId: `agent:${agentResult.agent.agentId}`,
          email: agentResult.agent.walletAddress,
          name: `Agent ${agentResult.agent.agentId.slice(0, 8)}`,
          loginMethod: 'erc8004',
          role: 'developer',
          emailVerified: true, // AI Agents are pre-verified
        }
      });
    }

    // 生成标准JWT tokens
    const accessToken = authStandalone.generateAccessToken(user);
    const refreshToken = authStandalone.generateRefreshToken(user);

    // 设置HTTP-only cookies
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie('jwt_token', accessToken, cookieOptions);
    ctx.res.cookie('jwt_refresh', refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    };
  }),
```

---

#### Step 2: 修改前端 - 登录后调用转换API

修改`client/src/pages/AgentAuth.tsx`：

```typescript
// 修改第144-154行
if (result.success) {
  toast({
    title: "Authentication Successful",
    description: `Welcome, Agent ${result.agent?.agentId.slice(0, 8)}...`
  });

  // ✅ NEW: 调用token转换API
  try {
    const convertResult = await fetch('/api/trpc/auth.convertAgentToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: { erc8004Token: result.token }
      })
    });

    const convertData = await convertResult.json();

    if (convertData.result?.data?.json?.success) {
      // JWT token已设置为cookie，localStorage不需要存储
      // 刷新auth状态
      window.location.href = '/';
    } else {
      throw new Error('Token conversion failed');
    }
  } catch (error) {
    toast({
      title: "Session Setup Failed",
      description: "Please try again",
      variant: "destructive"
    });
    return;
  }
}
```

---

### 方案2：使用Authorization Header（备选）

如果不想修改后端太多，可以在每个请求中添加Authorization header。

#### Step 1: 修改tRPC client配置

修改`client/src/lib/trpc.ts`：

```typescript
export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      headers: () => {
        const headers: Record<string, string> = {};

        // 添加ERC-8004 token到header
        const erc8004Token = localStorage.getItem('erc8004_token');
        if (erc8004Token) {
          headers['Authorization'] = `Bearer ${erc8004Token}`;
        }

        return headers;
      },
    }),
  ],
});
```

#### Step 2: 修改后端authenticateRequest

修改`server/_core/sdk.ts`的`authenticateRequest`方法：

```typescript
async authenticateRequest(req: Request): Promise<User> {
  const cookies = this.parseCookies(req.headers.cookie);

  // Try JWT token first (new auth system)
  const jwtToken = cookies.get('jwt_token');
  if (jwtToken) {
    // ... existing code
  }

  // ✅ NEW: Try Authorization header (for AI Agents)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const agentAuth = await import('../auth-ai-agent');
      const result = await agentAuth.verifyERC8004Token(token);

      if (result.success && result.agent) {
        // 从AI Agent获取或创建User记录
        let user = await db.getUserByOpenId(`agent:${result.agent.agentId}`);
        if (!user) {
          await db.upsertUser({
            openId: `agent:${result.agent.agentId}`,
            name: `Agent ${result.agent.agentId.slice(0, 8)}`,
            email: result.agent.walletAddress,
            loginMethod: 'erc8004',
            lastSignedIn: new Date(),
          });
          user = await db.getUserByOpenId(`agent:${result.agent.agentId}`);
        }
        if (user) return user as User;
      }
    } catch (error) {
      logger.error(" ERC-8004 token validation failed:", { error });
    }
  }

  // Fallback to old Manus OAuth session
  // ... existing code
}
```

---

## 🚀 推荐实施步骤

### 使用方案1（统一JWT）

**优势**：
- ✅ 安全性高（HTTP-only cookies防止XSS）
- ✅ 与现有认证系统统一
- ✅ 无需修改每个API请求

**缺点**：
- ⚠️ 需要修改后端和前端
- ⚠️ 需要添加新的tRPC endpoint

**步骤**：

1. **创建AI Agent token验证函数**（如果不存在）
   - 文件：`server/auth-ai-agent.ts`
   - 函数：`verifyERC8004Token(token: string)`

2. **添加convertAgentToken endpoint**
   - 文件：`server/routers/auth-unified.ts`
   - 添加上面的完整endpoint代码

3. **修改前端登录流程**
   - 文件：`client/src/pages/AgentAuth.tsx`
   - 修改第144-154行，添加token转换调用

4. **测试流程**
   ```bash
   # 1. AI Agent登录
   # 2. 验证cookie中有jwt_token
   # 3. 验证useAuth返回isAuthenticated=true
   # 4. 验证可以发布产品
   ```

---

### 使用方案2（Authorization Header）

**优势**：
- ✅ 修改较小
- ✅ 保持ERC-8004 token独立性

**缺点**：
- ⚠️ 每个请求都需要带header
- ⚠️ localStorage存储不如HTTP-only cookie安全

**步骤**：

1. **修改tRPC client配置**
   - 文件：`client/src/lib/trpc.ts`

2. **修改authenticateRequest**
   - 文件：`server/_core/sdk.ts`

3. **创建ERC-8004 token验证函数**（如果不存在）
   - 文件：`server/auth-ai-agent.ts`

---

## 🧪 测试验证

### 测试清单

- [ ] AI Agent登录成功
- [ ] 登录后`useAuth`返回`isAuthenticated: true`
- [ ] 登录后`useAuth.user`包含用户信息
- [ ] 可以访问需要认证的页面（如发布产品）
- [ ] 刷新页面后仍保持登录状态
- [ ] 可以正常logout

### 测试命令

```bash
# 1. 登录
# 访问 /auth/agent
# 连接钱包并签名

# 2. 验证cookies
# 打开浏览器DevTools → Application → Cookies
# 应该看到 jwt_token

# 3. 验证localStorage（如果使用方案2）
localStorage.getItem('erc8004_token')

# 4. 检查认证状态
# 打开Console
console.log(window.location.href, document.cookie)

# 5. 测试API调用
fetch('/api/trpc/auth.me')
  .then(r => r.json())
  .then(console.log)
```

---

## 📊 影响分析

### 需要修改的文件

**方案1**：
- `server/routers/auth-unified.ts` - 添加convertAgentToken endpoint
- `server/auth-ai-agent.ts` - 添加verifyERC8004Token（如果不存在）
- `client/src/pages/AgentAuth.tsx` - 修改登录成功处理

**方案2**：
- `client/src/lib/trpc.ts` - 添加Authorization header
- `server/_core/sdk.ts` - 修改authenticateRequest
- `server/auth-ai-agent.ts` - 添加verifyERC8004Token（如果不存在）

### 风险评估

- **方案1**: 低风险（使用标准JWT流程）
- **方案2**: 中风险（需要确保所有API都支持header认证）

---

## 🎯 Manus 任务指令

### 如果选择方案1（推荐）

```
任务: 修复AI Agent登录后显示未登录的问题

步骤1: 检查是否存在 verifyERC8004Token 函数
- 文件: server/auth-ai-agent.ts
- 如果不存在，需要先实现这个函数

步骤2: 在 server/routers/auth-unified.ts 添加 convertAgentToken endpoint
- 位置: 在 logout endpoint 之前
- 代码: 见 AI_LOGIN_BUG_FIX.md 中的完整代码

步骤3: 修改 client/src/pages/AgentAuth.tsx
- 位置: 第144-154行
- 修改: 添加token转换API调用
- 代码: 见文档中的修改示例

步骤4: 测试
- AI Agent登录
- 验证jwt_token cookie存在
- 验证可以发布产品

限制:
- 只修改指定的文件和位置
- 不要删除现有代码
- 保持代码风格一致
```

---

## 📞 故障排查

### 问题1: convertAgentToken返回401
**原因**: ERC-8004 token验证失败

**检查**:
```bash
# 查看后端日志
pm2 logs awareness-backend | grep "ERC-8004"

# 检查token格式
localStorage.getItem('erc8004_token')
```

### 问题2: 登录后立即重定向到登录页
**原因**: JWT token没有正确设置为cookie

**检查**:
```bash
# DevTools → Application → Cookies
# 应该看到 jwt_token 和 jwt_refresh
```

### 问题3: 刷新后又变成未登录
**原因**: Cookie没有持久化

**检查**: convertAgentToken endpoint是否正确设置了cookie的maxAge

---

**创建日期**: 2026-02-03
**优先级**: P0 - Critical
**预计修复时间**: 2-3小时
