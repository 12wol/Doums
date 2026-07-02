# Doums 发布指南

## 一期推荐方案：本机运行（最适合个人使用）

### 为什么选本机？

- 只有你一个人用，无需公网暴露
- SQLite 零配置，数据文件在本地 `prisma/dev.db`
- 开发调试方便，改完即看
- 无服务器费用

### 本机运行步骤

```bash
npm install
npm run db:setup
npm run dev
```

访问 `http://localhost:3000`

### 手机同局域网访问

1. 查看电脑局域网 IP（如 `192.168.1.100`）
2. 以该 IP 启动：

```bash
npx next dev -H 0.0.0.0
```

3. 手机浏览器访问 `http://192.168.1.100:3000`

> 确保防火墙允许 3000 端口入站。

### 本机生产模式

```bash
npm run build
npm run start
```

---

## 数据库选型建议

| 阶段 | 推荐数据库 | 理由 |
|------|-----------|------|
| **一期（个人本机）** | **SQLite** | 单文件、零运维、Prisma 原生支持，备份只需复制 `.db` 文件 |
| **二期（图纸识别）** | SQLite | 功能增量不涉及多用户，继续本机即可 |
| **三期（上线）** | **PostgreSQL** | 并发、可靠性、云托管成熟；Prisma 一行改 `provider` 即可迁移 |
| 四期（多用户） | PostgreSQL | 必须，支持连接池与事务隔离 |

### SQLite → PostgreSQL 迁移

1. 修改 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. 设置环境变量：

```
DATABASE_URL="postgresql://user:pass@host:5432/doums"
```

3. 运行 `npx prisma db push` 并重新 seed。

---

## 三期发布方案对比

### 方案 A：Vercel + Neon PostgreSQL（推荐 · 最简单）

| 项目 | 说明 |
|------|------|
| 前端/后端 | Vercel 托管 Next.js（免费额度够个人用） |
| 数据库 | [Neon](https://neon.tech) 免费 PostgreSQL |
| 域名 | Vercel 提供免费 `*.vercel.app` 子域名 |
| HTTPS | 自动 |
| 月费 | 免费起步 |
| 适合 | 个人项目快速上线 |

**发布步骤**：
1. 推送代码到 GitHub
2. [vercel.com](https://vercel.com) 导入仓库
3. 环境变量设置 `DATABASE_URL`
4. 部署完成

### 方案 B：自有 VPS（推荐 · 完全掌控）

| 项目 | 说明 |
|------|------|
| 服务器 | 阿里云/腾讯云轻量 2C2G（约 ¥50-100/月） |
| 部署 | Docker Compose：Next.js + PostgreSQL + Nginx |
| 域名 | 自备域名 + Let's Encrypt SSL |
| 适合 | 需要数据完全自主、长期稳定运行 |

**发布步骤概要**：
1. 服务器安装 Docker
2. 编写 `docker-compose.yml`（app + postgres + nginx）
3. 配置域名 DNS 指向服务器 IP
4. `docker compose up -d`

### 方案 C：本机内网穿透（临时方案）

| 项目 | 说明 |
|------|------|
| 工具 | frp / ngrok / Cloudflare Tunnel |
| 适合 | 临时让外网访问本机，不建议长期使用 |
| 缺点 | 电脑需常开、带宽受限、安全性需注意 |

---

## 发布需求清单

### 一期（本机）

- [x] Node.js 20+
- [x] 无需域名
- [x] 无需服务器
- [x] SQLite 自动创建

### 三期（上线）

- [ ] GitHub 仓库（已有：https://github.com/12wol/Doums.git）
- [ ] PostgreSQL 数据库实例
- [ ] 域名（可选，Vercel 子域名即可）
- [ ] 环境变量：`DATABASE_URL`
- [ ] 数据备份策略（PostgreSQL 定期 dump 或云厂商自动备份）

### 四期（账号）

- [ ] 认证服务（NextAuth / Clerk）
- [ ] 邮件服务（注册验证，可选）
- [ ] 用户数据隔离改造

---

## 最佳实践建议

```
一期：本机 SQLite + npm run dev          ← 你现在在这里
二期：本机 + 图纸识别功能
三期：Vercel + Neon（最省事）或 VPS（最自主）
四期：加认证 + 用户隔离
```

**数据备份（一期）**：定期复制 `prisma/dev.db` 到云盘或 U 盘。

**数据备份（三期）**：PostgreSQL 每日自动备份，保留 7 天。

---

## 环境变量参考

```env
# 一期（默认）
DATABASE_URL="file:./dev.db"

# 三期（PostgreSQL）
DATABASE_URL="postgresql://user:password@host:5432/doums?sslmode=require"

# 四期（可选）
NEXTAUTH_SECRET="随机字符串"
NEXTAUTH_URL="https://your-domain.com"
```
