# 邮件验证码系统修复指南

## 🐛 问题诊断

用户报告的问题：
1. ❌ 新用户收不到验证码
2. ❌ 重新发送按钮无效
3. ❌ 有效时间显示 23h 59m (不合理)

### 根本原因

**前端调用了不存在的后端API！**

前端 (`EmailVerification.tsx`) 调用：
```typescript
trpc.auth.verificationStatus.useQuery()  // ❌ 不存在
trpc.auth.verifyEmail.useMutation()       // ❌ 不存在
trpc.auth.sendVerificationEmail.useMutation() // ❌ 不存在
```

但 `server/routers/auth-unified.ts` 中**根本没有实现这些endpoints**！

---

## 📋 缺失的功能

### 1. 验证码存储
当前注册流程 (`auth-standalone.ts` 第96-131行)：
- ✅ 创建用户
- ✅ 设置 `emailVerified: false`
- ❌ **没有生成验证码**
- ❌ **没有发送验证邮件**

### 2. 验证码发送
`email-service.ts` 有：
- ✅ `sendPasswordResetEmail()` - 发送密码重置邮件
- ❌ **缺少 `sendVerificationCodeEmail()`** - 发送注册验证码邮件

### 3. 验证码验证
- ❌ 缺少验证码校验逻辑
- ❌ 缺少有效期检查
- ❌ 缺少重发冷却时间

---

## ✅ 完整修复方案

### Step 1: 添加验证码数据表

需要在 Prisma schema 中添加 `VerificationCode` 表：

```prisma
// prisma/schema.prisma

model VerificationCode {
  id        Int      @id @default(autoincrement())
  userId    Int
  email     String
  code      String   // 6-digit code
  type      String   @default("email_verification") // "email_verification" | "password_reset"
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([email, code, type])
  @@index([expiresAt])
}

// 更新 User model，添加关联
model User {
  // ... existing fields ...
  verificationCodes VerificationCode[]
}
```

**执行迁移**:
```bash
cd ~/Awareness-Market/Awareness-Network
pnpm prisma migrate dev --name add_verification_codes
```

---

### Step 2: 添加发送验证码邮件函数

在 `server/email-service.ts` 添加：

```typescript
/**
 * Send email verification code
 */
export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  expiresInMinutes: number = 10
): Promise<boolean> {
  const subject = "Verify Your Awareness Account";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✉️ Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Welcome to Awareness Market!</p>
          <p>Please use the verification code below to complete your registration:</p>

          <div class="code-box">
            <div class="code">${code}</div>
          </div>

          <p><strong>This code will expire in ${expiresInMinutes} minutes.</strong></p>

          <p>If you didn't create an account, please ignore this email.</p>

          <div class="footer">
            <p>© 2026 Awareness Market. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Awareness Market!

Your verification code is: ${code}

This code will expire in ${expiresInMinutes} minutes.

If you didn't create an account, please ignore this email.

© 2026 Awareness Market. All rights reserved.
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}
```

---

### Step 3: 添加验证码管理函数

在 `server/auth-standalone.ts` 添加：

```typescript
import { generateVerificationCode, sendVerificationCodeEmail } from './email-service';

/**
 * Generate and send verification code
 */
export async function sendEmailVerificationCode(
  userId: number,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check rate limiting - only allow one code every 60 seconds
    const recentCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        type: 'email_verification',
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // Last 60 seconds
        },
      },
    });

    if (recentCode) {
      const waitTime = Math.ceil((60000 - (Date.now() - recentCode.createdAt.getTime())) / 1000);
      return {
        success: false,
        error: `Please wait ${waitTime} seconds before requesting another code`
      };
    }

    // Generate 6-digit code
    const code = generateVerificationCode();
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Save code to database
    await prisma.verificationCode.create({
      data: {
        userId,
        email,
        code,
        type: 'email_verification',
        expiresAt,
      },
    });

    // Send email
    const emailSent = await sendVerificationCodeEmail(email, code, expiresInMinutes);

    if (!emailSent) {
      return { success: false, error: 'Failed to send verification email' };
    }

    return { success: true };
  } catch (error) {
    console.error('[sendEmailVerificationCode] Error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Verify email with code
 */
export async function verifyEmailWithCode(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find valid code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        type: 'email_verification',
        used: false,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
    });

    if (!verificationCode) {
      return { success: false, error: 'Invalid or expired verification code' };
    }

    // Mark code as used
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { used: true },
    });

    // Update user email verification status
    await prisma.user.update({
      where: { id: verificationCode.userId },
      data: { emailVerified: true },
    });

    return { success: true };
  } catch (error) {
    console.error('[verifyEmailWithCode] Error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Get verification status
 */
export async function getVerificationStatus(
  email: string
): Promise<{
  hasPendingCode: boolean;
  expiresIn: number | null;
  canResend: boolean;
}> {
  const latestCode = await prisma.verificationCode.findFirst({
    where: {
      email,
      type: 'email_verification',
      used: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!latestCode) {
    return {
      hasPendingCode: false,
      expiresIn: null,
      canResend: true,
    };
  }

  const now = Date.now();
  const expiresAt = latestCode.expiresAt.getTime();
  const createdAt = latestCode.createdAt.getTime();

  const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000)); // seconds
  const canResend = (now - createdAt) >= 60 * 1000; // Can resend after 60 seconds

  return {
    hasPendingCode: expiresIn > 0,
    expiresIn: expiresIn > 0 ? expiresIn : null,
    canResend,
  };
}
```

---

### Step 4: 添加 tRPC API Endpoints

在 `server/routers/auth-unified.ts` 添加：

```typescript
import * as authStandalone from '../auth-standalone';

export const authUnifiedRouter = router({
  // ... existing endpoints ...

  /**
   * Send verification email
   */
  sendVerificationEmail: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user.email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No email associated with this account',
        });
      }

      const result = await authStandalone.sendEmailVerificationCode(
        ctx.user.id,
        ctx.user.email
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Failed to send verification email',
        });
      }

      return { success: true };
    }),

  /**
   * Verify email with code
   */
  verifyEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string().length(6),
    }))
    .mutation(async ({ input }) => {
      const result = await authStandalone.verifyEmailWithCode(
        input.email,
        input.code
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Verification failed',
        };
      }

      return { success: true };
    }),

  /**
   * Get verification status
   */
  verificationStatus: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .query(async ({ input }) => {
      const status = await authStandalone.getVerificationStatus(input.email);
      return status;
    }),
});
```

---

### Step 5: 更新注册流程

修改 `server/auth-standalone.ts` 的 `registerWithEmail` 函数：

```typescript
export async function registerWithEmail(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<{
  success: boolean;
  userId?: number;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  needsVerification?: boolean;
}> {
  // ... existing code ...

  const newUser = await prisma.user.create({
    data: {
      email: params.email,
      password: passwordHash,
      name: params.name || params.email.split("@")[0],
      openId: nanoid(),
      loginMethod: "email",
      role: "consumer",
      emailVerified: false, // ✅ Important: set to false
    }
  });

  // ✅ NEW: Send verification email
  await sendEmailVerificationCode(newUser.id, newUser.email!);

  // Generate tokens
  const accessToken = generateAccessToken(newUser);
  const refreshToken = generateRefreshToken(newUser);

  return {
    success: true,
    userId: newUser.id,
    accessToken,
    refreshToken,
    needsVerification: true, // ✅ NEW: indicate verification needed
  };
}
```

---

## 🔧 Resend API 配置检查

### 验证 Resend 配置

```bash
# 在 EC2 上检查环境变量
cd ~/Awareness-Market/Awareness-Network
cat .env | grep RESEND
```

**预期输出**:
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@awareness.market
EMAIL_FROM_NAME=Awareness Market
```

### 测试 Resend API

```bash
# 启动 Node REPL
node

# 在 REPL 中测试
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY); // 使用环境变量

resend.emails.send({
  from: 'Awareness Market <noreply@awareness.market>',
  to: ['your-email@example.com'], // 换成你的邮箱
  subject: 'Test Email',
  html: '<p>This is a test email from Awareness Market</p>',
}).then(console.log).catch(console.error);
```

**常见错误**:

1. **Domain Not Verified** (域名未验证)
```json
{
  "error": {
    "message": "Domain not verified",
    "code": "validation_error"
  }
}
```
**解决**: 在 Resend Dashboard 验证域名 `awareness.market`

2. **API Key Invalid** (API 密钥无效)
```json
{
  "error": {
    "message": "Invalid API key",
    "code": "invalid_api_key"
  }
}
```
**解决**: 检查 `.env` 中的 `RESEND_API_KEY` 是否正确

---

## 🚀 部署步骤

### 1. 更新数据库 Schema

```bash
ssh ec2-user@44.220.181.78
cd ~/Awareness-Market/Awareness-Network

# 添加 VerificationCode model 到 prisma/schema.prisma
# (复制上面 Step 1 的代码)

# 运行迁移
pnpm prisma migrate dev --name add_verification_codes

# 生成 Prisma Client
pnpm prisma generate
```

### 2. 更新代码

```bash
# 在本地更新代码:
# 1. email-service.ts - 添加 sendVerificationCodeEmail()
# 2. auth-standalone.ts - 添加验证码管理函数
# 3. auth-unified.ts - 添加 3 个新 endpoints

# 提交并推送
git add .
git commit -m "feat: Add email verification system"
git push origin main
```

### 3. 部署到 EC2

```bash
# 在 EC2 上
cd ~/Awareness-Market/Awareness-Network
git pull origin main

# 安装依赖（如果需要）
pnpm install

# 重启后端
pm2 restart awareness-backend

# 查看日志
pm2 logs awareness-backend
```

### 4. 测试验证流程

1. **注册新用户**: 访问 https://awareness.market/auth
2. **检查邮箱**: 应该收到验证码邮件
3. **输入验证码**: 在验证页面输入 6 位数字
4. **验证成功**: 显示成功消息并重定向到登录

---

## 📊 验证码有效期配置

当前设置：
- **有效期**: 10 分钟 (600 秒)
- **重发冷却**: 60 秒
- **显示格式**: "Code expires in 0h 9m" (正确)

如果显示 "23h 59m"，说明 API 返回了错误的过期时间。修复后端后会自动解决。

---

## 🆘 故障排查

### 问题 1: 收不到邮件

**检查步骤**:
```bash
# 1. 查看后端日志
pm2 logs awareness-backend | grep -i "email\|resend"

# 2. 检查 Resend API 状态
curl https://api.resend.com/emails \\
  -H "Authorization: Bearer $RESEND_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "Awareness Market <noreply@awareness.market>",
    "to": ["test@example.com"],
    "subject": "Test",
    "html": "<p>Test</p>"
  }'
```

### 问题 2: 验证码无效

**检查数据库**:
```sql
-- 查看最近的验证码
SELECT * FROM VerificationCode
WHERE email = 'user@example.com'
ORDER BY createdAt DESC
LIMIT 5;
```

### 问题 3: 重发按钮一直disabled

**原因**: `status.canResend` 返回 false

**检查**:
- 60秒冷却期是否已过
- 数据库中是否有旧的未使用验证码

---

## ✅ 完成检查清单

修复完成后，验证以下功能：

- [ ] 用户注册后自动发送验证码邮件
- [ ] 邮箱收到 6 位数验证码
- [ ] 验证码有效期显示正确 (例如: "9m")
- [ ] 输入正确验证码后验证成功
- [ ] 输入错误验证码显示错误消息
- [ ] 验证码过期后无法使用
- [ ] 重发按钮在 60 秒后可用
- [ ] 重发功能正常工作
- [ ] 验证成功后 emailVerified 字段更新为 true

---

## 📞 需要帮助？

如果按照以上步骤仍然有问题，请提供：

1. 后端日志: `pm2 logs awareness-backend --lines 100`
2. Resend API 测试结果
3. 浏览器控制台错误 (F12 → Console)
4. Network 标签中失败的 API 请求

我会提供针对性的解决方案！
