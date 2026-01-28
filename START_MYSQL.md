# MySQL 快速启动指南

## 错误信息
```
Error: ECONNREFUSED
Cannot connect to MySQL at localhost:3306
```

## 解决方案

### 方法 1: 通过 Windows 服务启动 (推荐)

**步骤 1: 以管理员身份运行命令提示符**
1. 按 `Win + X`
2. 选择 "Windows PowerShell (管理员)" 或 "命令提示符 (管理员)"

**步骤 2: 启动 MySQL 服务**
```cmd
net start MySQL80
```

如果服务名不是 `MySQL80`，尝试：
```cmd
net start MySQL
net start MySQL57
net start wampmysqld64
```

**步骤 3: 验证 MySQL 正在运行**
```cmd
mysql -u root -p
```
输入密码后，应该能看到 `mysql>` 提示符。

---

### 方法 2: 通过 XAMPP 启动

1. 打开 XAMPP Control Panel
2. 找到 "MySQL" 行
3. 点击 "Start" 按钮
4. 等待状态变为绿色 "Running"

---

### 方法 3: 通过 WAMP 启动

1. 打开 WAMP 服务器
2. 点击系统托盘中的 WAMP 图标
3. 选择 "Start All Services"
4. 等待图标变为绿色

---

### 方法 4: 通过 MySQL Workbench 启动

1. 打开 MySQL Workbench
2. 连接到本地实例
3. 如果提示服务未运行，选择 "启动服务"

---

## 验证 MySQL 已启动

### 检查服务状态
```cmd
sc query MySQL80
```

应该看到 `STATE: 4 RUNNING`

### 测试连接
```cmd
mysql -u root -p
```

### 检查端口
```cmd
netstat -ano | findstr :3306
```

应该看到类似：
```
TCP    0.0.0.0:3306           0.0.0.0:0              LISTENING       1234
```

---

## 常见问题

### 问题 1: "服务名无效"
**解决方案**: 检查实际的 MySQL 服务名
```cmd
sc query type= service state= all | findstr /i "mysql"
```

### 问题 2: "拒绝访问"
**解决方案**: 以管理员身份运行命令提示符

### 问题 3: "服务无法启动"
**解决方案**: 检查 MySQL 错误日志
- XAMPP: `C:\xampp\mysql\data\*.err`
- WAMP: `C:\wamp64\logs\mysql_error.log`
- 默认安装: `C:\ProgramData\MySQL\MySQL Server 8.0\Data\*.err`

### 问题 4: 端口 3306 被占用
**解决方案**: 检查哪个程序在使用端口
```cmd
netstat -ano | findstr :3306
tasklist /FI "PID eq [PID_NUMBER]"
```

---

## 成功后的下一步

一旦 MySQL 启动成功，运行数据库迁移：

```bash
cd "e:\Awareness Market\Awareness-Network"
npm run db:push
```

预期输出：
```
✔ 0010_workflows.sql applied
✔ 0011_w_matrix_compatibility.sql applied
✔ Done!
```

---

## 需要帮助？

如果遇到问题：

1. 检查 MySQL 安装路径
2. 确认 MySQL 版本 (5.7, 8.0, 等)
3. 查看错误日志文件
4. 确认防火墙没有阻止端口 3306

**当前数据库配置** (来自 `.env`):
```
DATABASE_URL=mysql://root@localhost:3306/awareness_market
```

- 用户名: `root`
- 密码: (空)
- 主机: `localhost`
- 端口: `3306`
- 数据库: `awareness_market`
