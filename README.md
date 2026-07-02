# Doums · 拼豆库存管理

基于 MARD 221 色标准的拼豆（融合豆）库存与消耗管理系统。

## 功能概览

### 一期（当前）

- **多豆仓管理**：创建豆仓 1、2、3…，每个仓库自动生成唯一码（如 `WH-A3K9M2`）
- **初始库存**：新建豆仓时自动初始化 221 色 MARD 标准色号，默认每色 1000 粒（可配置）
- **色号管理**：查看/编辑色号名称、HEX 颜色、配图 URL
- **库存编辑**：按色系筛选、搜索，逐色修改库存数量
- **手动消耗**：选择豆仓，录入各色消耗量，自动扣减库存
- **仪表盘**：总库存、低库存预警、色系分布、最近消耗记录
- **响应式界面**：兼容手机与桌面，设计参考 `DESIGN-figma.md`

### 后续规划

见 [ROADMAP.md](./ROADMAP.md)

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 15 (App Router) + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 数据库 | SQLite（一期本机）→ PostgreSQL（三期上线） |
| ORM | Prisma |

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/12wol/Doums.git
cd Doums

# 安装依赖
npm install

# 初始化数据库（创建表 + 导入 221 色 MARD 色号）
npm run db:setup

# 启动开发服务器
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)

### 常用命令

```bash
npm run dev        # 开发模式
npm run build      # 生产构建
npm run start      # 生产运行
npm run db:push    # 同步数据库结构
npm run db:seed    # 导入 MARD 色号（仅首次）
```

## 项目结构

```
Doums/
├── prisma/
│   ├── schema.prisma    # 数据模型
│   └── seed.ts          # MARD 221 色种子数据
├── src/
│   ├── app/             # 页面与 API 路由
│   ├── components/      # UI 组件
│   ├── data/            # MARD 色号静态数据
│   └── lib/             # 工具函数
├── DESIGN-figma.md      # UI 设计规范
├── docs/PHASE2-TECH.md  # 二期技术设计
├── ROADMAP.md           # 多期规划
└── DEPLOYMENT.md        # 发布指南
```

## 色号数据来源

MARD 221 色 HEX 值参考公开色卡数据（[豆豆工坊](https://www.doudougongfang.com/kb/beads/mard-palette)、[拼豆工具站](https://www.pindou.online/colors)）。屏幕显示色与实物可能存在偏差，请以实物对色为准。

## 许可证

私有项目，仅供个人使用。
