# MySQL 快速启动指南（已弃用）

本项目已统一使用 **PostgreSQL + Prisma**，不再支持 MySQL。

请改用以下文档完成数据库配置与迁移：

- [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)

如需本地快速启动，请参考 PostgreSQL 的本地安装与连接说明，并运行：

```bash
pnpm prisma generate
pnpm prisma migrate deploy
```
