# New Backend (TypeScript/Elysia)

TypeScript/Elysia 实现的博客后端 API，用于替代现有的 Rust backend。

## 🎯 项目状态

✅ **API 迁移完成度：100%**

所有 Rust backend 的 API 路由已成功迁移到 TypeScript。详见 [API 迁移完成报告](./docs/api-migration-complete.md)

## 特性

- 🚀 基于 Bun 和 Elysia 的高性能 API
- 📦 统一的数据库操作接口 (db.ts)
- 🔐 JWT 认证和授权（支持 OAuth）
- 📄 统一的响应格式
- 🔍 完善的数据库索引优化
- 📊 分页、过滤和排序支持
- 💬 完整的评论系统（含管理功能）
- 🔄 实时通信（SSE + WebSocket）
- 🧪 单元测试和属性测试（100+ 测试用例）
- 📝 详细的 API 文档

## 📋 完整 API 列表

### 内容管理
- Posts API (4 endpoints)
- Notes API (4 endpoints)
- Categories API (1 endpoint)
- Pages API (1 endpoint)
- Recentlies API (1 endpoint)

### 用户与认证
- Auth API (8 endpoints)
- Users/Readers API (3 endpoints)

### 互动功能
- Comments API (8 endpoints)
- Links API (4 endpoints)

### 高级功能
- AI API (2 endpoints)
- Tools API (1 endpoint)
- Realtime API (2 endpoints)
- Static API (1 endpoint)

**总计：40+ API 端点**

## 快速开始

### 安装依赖

```bash
bun install
```

### 配置环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
cp .env.example .env
```

### 运行开发服务器

```bash
bun run dev
```

### 运行测试

```bash
bun test
```

## 数据库索引管理

### 创建索引

应用启动时会自动创建索引。也可以手动运行：

```bash
bun run indexes:create
```

### 列出索引

查看所有集合的索引：

```bash
bun run indexes:list
```

### 删除索引

删除所有自定义索引（保留 `_id` 索引）：

```bash
bun run indexes:drop
```

**警告：** 删除索引会影响查询性能，仅建议在开发/测试环境使用。

## 项目结构

```
new_backend/
├── src/
│   ├── index.ts              # 应用入口
│   ├── config/
│   │   └── index.ts          # 配置管理
│   ├── lib/
│   │   ├── db.ts             # 数据库操作接口
│   │   ├── cache.ts          # 缓存管理
│   │   ├── indexes.ts        # 数据库索引管理
│   │   └── utils.ts          # 工具函数
│   ├── types/
│   │   ├── models.ts         # 数据模型类型定义
│   │   └── index.ts          # 通用类型
│   ├── middleware/
│   │   ├── auth.ts           # 认证中间件
│   │   └── error.ts          # 错误处理中间件
│   ├── plugins/
│   │   ├── pagination.ts     # 分页插件
│   │   └── response.ts       # 响应格式化插件
│   └── routes/
│       ├── posts.ts          # 文章路由
│       ├── notes.ts          # 日记路由
│       ├── categories.ts     # 分类路由
│       └── config.ts         # 配置路由
├── scripts/
│   └── manage-indexes.ts     # 索引管理脚本
├── tests/
│   └── unit/                 # 单元测试
├── docs/
│   └── database-indexes.md   # 数据库索引文档
├── package.json
└── tsconfig.json
```

## API 端点

### Posts (文章)

- `GET /api/posts` - 获取文章列表（支持分页、过滤、排序）
- `GET /api/posts/:id` - 根据 ID 获取文章
- `GET /api/posts/slug/:slug` - 根据 slug 获取文章
- `GET /api/posts/:id/adjacent` - 获取相邻文章

### Notes (日记)

- `GET /api/notes` - 获取日记列表（支持分页、过滤、排序）
- `GET /api/notes/:id` - 根据 ID 获取日记
- `GET /api/notes/nid/:nid` - 根据 nid 获取日记
- `GET /api/notes/:id/adjacent` - 获取相邻日记

### Categories (分类)

- `GET /api/categories` - 获取分类列表（包含文章数量）

### Config (配置)

- `GET /api/config` - 获取站点配置

## 数据库索引

系统为以下集合创建了优化索引：

### Posts 集合
- `slug` (唯一索引)
- `categoryId`, `tags`, `isPublished`
- `{ isPublished: 1, created: -1 }` (复合索引，用于分页查询)

### Notes 集合
- `nid` (唯一索引)
- `isPublished`
- `{ isPublished: 1, created: -1 }` (复合索引，用于分页查询)

### Categories 集合
- `slug` (唯一索引)
- `type`

### Links 集合
- `status`

### Comments 集合
- `refId`, `refType`, `parentId` (稀疏索引), `status`
- `{ refId: 1, refType: 1, created: -1 }` (复合索引)

### Pages 集合
- `slug` (唯一索引)
- `order`

### Users 集合
- `email` (唯一索引)
- `username` (唯一索引)

### Recentlies 集合
- `type`

详细的索引文档请参考 [docs/database-indexes.md](docs/database-indexes.md)。

## 性能优化

- ✅ 数据库索引优化
- ✅ 缓存策略（配置、分类列表）
- ✅ 连接池管理
- ✅ 响应大小限制

## 开发指南

### 添加新的 API 端点

1. 在 `src/routes/` 创建新的路由文件
2. 使用 `paginationPlugin()` 和 `responsePlugin()` 插件
3. 使用 `db.ts` 中的函数进行数据库操作
4. 在 `src/index.ts` 中注册路由

### 添加新的数据库索引

1. 在 `src/lib/indexes.ts` 的 `indexDefinitions` 数组中添加索引定义
2. 运行 `bun run indexes:create` 创建索引
3. 更新 `docs/database-indexes.md` 文档

## 文档

- [数据库索引文档](docs/database-indexes.md)
- [API 设计文档](../.kiro/specs/api-refactor/design.md)
- [需求文档](../.kiro/specs/api-refactor/requirements.md)

## 许可证

MIT
