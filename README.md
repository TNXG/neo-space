# 🚀 Neo-Space

<div align="center">

**现代化全栈博客系统**

基于 Next.js 16 + Rust/Axum 构建的高性能博客平台

[![License](https://img.shields.io/badge/license-AGPL-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black.svg)](https://nextjs.org/)
[![Rust](https://img.shields.io/badge/Rust-1.83-orange.svg)](https://www.rust-lang.org/)

[功能介绍](#-核心特性) • [快速开始](#-快速开始) • [技术文档](#技术架构)

</div>

---

## ✨ 项目简介

Neo-Space 是一个功能丰富、性能卓越的现代化博客系统。采用前后端分离架构，前端使用 **Next.js 16** 实现极致的 SSR/SSG 渲染体验，后端基于 **Rust/Axum** 提供高性能的 API 服务。

### 🎯 设计理念

- **性能优先**：Rust 后端 + Next.js 前端，追求极致性能
- **开发体验**：TypeScript 全栈，类型安全，开发效率高
- **现代化技术栈**：采用最新的 Web 技术和最佳实践
- **可扩展性**：模块化设计，易于扩展和维护

---

## 🌟 核心特性

### 内容管理

| 功能            | 描述                                        |
| --------------- | ------------------------------------------- |
| 📝 **文章系统** | 支持 Markdown、代码高亮、数学公式、图片管理 |
| 📔 **日记系统** | Mood/Weather/Location 标签的碎片化记录      |
| 📄 **页面系统** | 静态页面支持，关于、友链等独立页面          |
| 🏷️ **分类管理** | 文章分类系统，支持多级分类                  |

### 评论系统

- 💬 **多层级评论**：支持无限嵌套回复
- 🤫 **悄悄说功能**：仅评论者和管理员可见
- 📌 **评论管理**：置顶、隐藏、显示状态管理
- 🛡️ **垃圾评论过滤**：多层过滤机制 + Cloudflare Turnstile
- 🔔 **实时通知**：WebSocket 实时推送新评论

### 用户系统

- 🔐 **OAuth 认证**：支持 GitHub 和 QQ 登录
- 👤 **匿名用户**：可绑定邮箱成为正式用户
- 👑 **权限管理**：区分普通用户和管理员

### 友链系统

- 🔗 **自动健康检查**：定时检测友链可用性
- 📨 **申请审核**：支持友链申请和审核流程
- 📡 **RSS 订阅**：支持友链 RSS Feed
- 🏷️ **技术栈标签**：展示友链技术栈

### AI 集成

- 🤖 **OpenAI 集成**：文章摘要自动生成
- 💭 **AI 评论回复**：模拟博主口吻的智能回复
- ⏰ **时间胶囊**：AI 分析文章时效性

### 搜索功能

- 🔍 **Meilisearch 引擎**：极速全文搜索
- 🎯 **高亮显示**：搜索结果关键词高亮
- 📊 **多维度搜索**：支持文章和日记搜索

---

## 🚀 快速开始

### 环境要求

- Node.js >= 20
- Rust >= 1.83
- MongoDB >= 7.0
- pnpm >= 9

### 一键启动（Docker）

```bash
# 克隆项目
git clone https://github.com/yourusername/neo-space.git
cd neo-space

# 配置环境变量
cp .env.local.example .env.local
cp backend/.env.example backend/.env

# 启动所有服务
docker-compose up -d
```

访问 http://localhost:3000

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动前端
pnpm dev              # 前端: localhost:3000

# 启动后端
cd backend
cargo run             # 后端: localhost:8000
```

---

## 📸 功能截图

> 💡 待补充：截图展示项目界面

---

## 📂 项目结构

```
neo-space/
├── backend/              # Rust 后端
│   ├── src/
│   │   ├── main.rs      # 服务入口
│   │   ├── app.rs       # 应用配置
│   │   ├── handlers/    # API 处理器
│   │   ├── routes/      # 路由定义
│   │   ├── models/      # 数据模型
│   │   ├── services/    # 业务逻辑
│   │   └── tasks/       # 后台任务
│   └── Cargo.toml
├── src/                  # Next.js 前端
│   ├── app/             # App Router
│   ├── components/      # 组件库
│   ├── lib/             # 工具库
│   ├── hooks/           # 自定义 Hooks
│   └── stores/          # 状态管理
├── public/              # 静态资源
└── docker-compose.yml  # Docker 编排
```

---

<a id="技术架构"></a>

## 🏗️ 技术架构

### 技术栈

**前端**：Next.js 16、React 19、TypeScript、Tailwind CSS、Zustand、SWR

**后端**：Rust、Axum、Tokio、MongoDB、Meilisearch

**特色**：WebSocket 实时通信、AI 集成、多层缓存、Docker 部署

### 架构层次

Neo-Space 采用现代化的前后端分离架构，通过 Rust 的高性能后端与 Next.js 的前端渲染能力相结合，构建了一个功能丰富、性能卓越的博客系统。

### 架构层次

```
客户端层 (Browser / Mobile / RSS)
    ↓
CDN / 反向代理层 (Nginx / Cloudflare)
    ↓
应用层
    ├── Frontend (Next.js)     → 客户端状态 (Zustand)
    └── Backend (Rust/Axum)    → 服务端缓存 (Moka)
    ↓
数据层
    ├── MongoDB (主数据库)
    ├── Meilisearch (搜索引擎)
    └── External APIs (OpenAI, OAuth)
```

### 技术栈总览

| 层级     | 技术选型     | 版本    | 用途          |
| -------- | ------------ | ------- | ------------- |
| 前端框架 | Next.js      | 16.1.6  | SSR/SSG 框架  |
| UI 库    | React        | 19.2.4  | 用户界面      |
| 语言     | TypeScript   | 5.9.3   | 类型安全      |
| 样式     | Tailwind CSS | 4.2.1   | 原子化 CSS    |
| 后端框架 | Axum         | 0.8.8   | 异步 Web 框架 |
| 运行时   | Tokio        | 1.50.0  | 异步运行时    |
| 数据库   | MongoDB      | 7.0     | 主数据存储    |
| 搜索引擎 | Meilisearch  | -       | 全文搜索      |
| 缓存     | Moka         | 0.12.14 | 内存缓存      |

---

## 前端架构设计

### 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── (main)/            # 主路由组
│   ├── auth/              # 认证页面
│   ├── api/               # API 路由
│   └── feed/              # RSS Feed
├── components/            # 组件库
│   ├── layouts/          # 布局组件
│   ├── common/           # 通用组件
│   ├── comment/          # 评论组件
│   └── ui/               # 原子 UI 组件
├── lib/                  # 工具库
├── hooks/                # 自定义 Hooks
├── stores/               # Zustand 状态管理
├── types/                # TypeScript 类型
└── actions/              # Server Actions
```

### 组件架构模式

采用**容器/展示组件分离**的设计模式：

- **容器组件**：负责数据获取、状态管理、业务逻辑
- **展示组件**：纯 UI 渲染，接收 props 并展示数据

采用**组合组件模式**实现灵活的组件复用。

### 状态管理架构

```
状态层级：
├── Server State (Next.js)          # 服务端状态
├── URL State (路由参数)            # URL 状态
├── Global Client State (Zustand)   # 全局客户端状态
│   ├── Auth Store                  # 认证状态
│   ├── Theme Store                 # 主题状态
│   ├── Search Store                # 搜索状态
│   └── Comment Store               # 评论状态
└── Local State (useState)          # 本地组件状态
```

使用 Zustand 的 persist 中间件实现状态持久化到 LocalStorage。

### 路由架构

基于 Next.js App Router 的文件系统路由：

- 路由组 `(main)`：共享布局，不影响 URL
- 动态路由 `[slug]`、`[id]`：支持动态参数
- 路由处理器：处理 OAuth 回调、API 请求

### 主题系统

采用 **CSS 变量驱动的主题系统**：

- 使用 Tailwind CSS 的 `@property` 定义 HSL 颜色变量
- 通过切换 `dark` 类名实现主题切换
- 支持 `light`、`dark`、`system` 三种模式
- 主题持久化到 LocalStorage

### 渲染策略

混合渲染架构优化性能与 SEO：

| 渲染方式 | 使用场景     | 页面示例                     |
| -------- | ------------ | ---------------------------- |
| SSR      | SEO 关键页面 | 首页、文章详情、分类列表     |
| SSG      | 静态内容     | RSS Feed                     |
| CSR      | 高交互组件   | 评论表单、搜索弹窗、主题切换 |

---

## 后端架构设计

### 目录结构

```
backend/src/
├── main.rs                 # 服务入口
├── app.rs                  # 应用状态与路由组装
├── config/                 # 配置管理
├── handlers/               # 请求处理器
│   ├── admin/             # 管理接口
│   ├── misc/              # 杂项接口
│   ├── post/              # 文章接口
│   ├── comment/           # 评论接口
│   ├── auth/              # 认证接口
│   └── link/              # 友链接口
├── routes/                 # 路由定义
├── models/                 # 数据模型
├── services/               # 业务服务
├── tasks/                  # 后台任务
├── middleware/             # 中间件
├── realtime/               # 实时通信
└── utils/                  # 工具函数
```

### 应用状态管理

**AppState 全局容器**包含：

- MongoDB 连接池
- Moka 内存缓存
- HTTP 客户端 (reqwest)
- WebSocket 事件总线
- 应用配置
- Meilisearch 客户端

### 路由架构

采用**模块化路由设计**：

- 使用 `Router::nest()` 按功能分组路由
- 中间件层：CORS、日志追踪、认证
- OpenAPI 文档自动生成与集成

### 处理器模式

**分层处理器设计**：

1. 缓存层检查
2. 数据库查询
3. 缓存写入
4. 事件广播
5. 前端缓存失效通知

### 后台任务架构

基于 `tokio::spawn` 的异步任务系统：

| 任务类型       | 执行方式 | 功能                 |
| -------------- | -------- | -------------------- |
| 友链健康检查   | 定时任务 | 检测友链可用性       |
| 网易云音乐状态 | 轮询任务 | 更新当前播放状态     |
| Change Stream  | 持久监听 | 监听数据库变更并广播 |

---

## 数据模型设计

### 核心数据模型

#### Post (文章模型)

- **基础字段**：\_id, title, text, slug, categoryId
- **分类关联**：category (查询时填充)
- **摘要**：summary (手动), aiSummary (AI 生成)
- **标签**：tags 数组
- **配置**：allowComment, isPublished, copyright
- **图片**：images 数组 (src, alt, width, height)

#### Note (日记模型)

- **基础字段**：\_id, nid (数字 ID), title, text
- **情境标签**：mood, weather, location
- **配置**：allowComment, isPublished, bookmark

#### Comment (评论模型)

- **基础字段**：\_id, ref, refType, author, mail, link
- **内容**：text (Markdown)
- **状态**：state (0=未读, 1=已读, 2=垃圾, 3=隐藏)
- **功能**：pin (置顶), isWhispers (悄悄说)
- **关联**：rid (回复 ID), pid (父 ID), children (子评论)
- **AI**：aiReply (AI 生成的回复)

#### User (用户模型)

- **基础字段**：\_id, username, mail, role
- **认证**：password, accounts (OAuth 账号)
- **资料**：avatar, website, bio

#### Link (友链模型)

- **基础字段**：\_id, name, url, description, avatar
- **状态**：active, isPublished
- **健康检查**：healthStatus, lastChecked, responseTime
- **技术栈**：techStack 数组
- **RSS**：rss Feed URL

### 数据库索引设计

| 集合       | 索引字段                      | 类型      |
| ---------- | ----------------------------- | --------- |
| posts      | slug, categoryId, created     | 唯一/普通 |
| notes      | nid, created                  | 唯一/普通 |
| comments   | ref+refType, rid, created     | 复合/普通 |
| users      | username, accounts.providerId | 唯一      |
| links      | url, active                   | 唯一/普通 |
| categories | slug, name                    | 唯一      |

---

## API 设计规范

### RESTful API 结构

```
/api
├── /auth                     # 认证相关
│   ├── /oauth/*             # OAuth 登录
│   ├── /me                  # 当前用户
│   └── /bind-anonymous      # 绑定匿名身份
├── /posts                    # 文章管理
│   ├── /                    # 文章列表
│   ├── /:id                 # 文章详情
│   ├── /slug/:slug          # 通过 slug 获取
│   └── /slug/:slug/adjacent # 相邻文章
├── /notes                    # 日记管理
├── /comments                 # 评论管理
├── /links                    # 友链管理
├── /categories               # 分类管理
├── /admin                    # 管理接口
├── /revalidate               # 缓存重验证
├── /config                   # 站点配置
├── /health                   # 健康检查
└── /ws                       # WebSocket 连接
```

### 标准响应格式

**成功响应**：

```json
{
  "code": 200,
  "status": "success",
  "message": "操作成功",
  "data": { /* 响应数据 */ }
}
```

**分页响应**：

```json
{
  "code": 200,
  "status": "success",
  "message": "获取成功",
  "data": {
    "items": [],
    "pagination": {
      "total": 100,
      "current_page": 1,
      "total_page": 10,
      "size": 10,
      "has_next_page": true,
      "has_prev_page": false
    }
  }
}
```

**错误响应**：

```json
{
  "code": 400,
  "status": "failed",
  "message": "错误描述",
  "data": null
}
```

### OpenAPI 文档

使用 Utoipa 宏自动生成 OpenAPI 3.0 规范，通过 Swagger UI 提供交互式文档。

---

## 实时通信架构

### WebSocket 事件系统

支持的事件类型：

| 事件类型            | 说明             |
| ------------------- | ---------------- |
| comment.created     | 新评论创建       |
| comment.updated     | 评论更新         |
| comment.deleted     | 评论删除         |
| post.created        | 文章发布         |
| post.updated        | 文章更新         |
| link.health_changed | 友链健康状态变化 |

### 广播机制

基于 `tokio::sync::broadcast` 的发布-订阅模式：

- EventBus 维护全局事件通道
- Change Stream 监听数据库变更并发布事件
- WebSocket 连接订阅事件并推送给客户端

### 前端集成

使用自定义 `useWebSocket` Hook：

- 自动连接与重连机制
- 事件消息分发与处理
- 与 Toast 通知系统集成
- SWR 缓存自动刷新

---

## 缓存策略

### 五层缓存架构

```
L1: Next.js Data Cache          # 服务端内存缓存
    ↓
L2: Browser HTTP Cache         # 客户端浏览器缓存
    ↓
L3: CDN Cache                  # 边缘节点缓存
    ↓
L4: Application Cache          # 应用层缓存
    ├── Moka (Rust 后端)
    ├── SWR (React 前端)
    └── Zustand Persist
    ↓
L5: Database Query Cache       # 数据库查询缓存
    ├── MongoDB 索引
    └── Meilisearch 缓存
```

### Moka 后端缓存

- **容量**：最大 10,000 条记录
- **TTL**：5 分钟
- **TTI**：1 分钟
- **驱逐策略**：LRU

### SWR 客户端缓存

- **去重间隔**：5 秒
- **重试次数**：3 次
- **保持旧数据**：直到新数据到达
- **自动重新验证**：窗口聚焦、网络重连

### 缓存失效策略

1. **路径级失效**：`revalidatePath()`
2. **标签级失效**：`revalidateTag()`
3. **时间级失效**：TTL/TTI 到期
4. **事件级失效**：WebSocket 事件触发

---

## 安全机制

### 认证与授权

**JWT Token 设计**：

- 使用 HS256 算法签名
- 7 天有效期
- 包含用户 ID、用户名、角色信息
- 存储在 HttpOnly Cookie 中

**认证中间件**：

- 公开接口直接放行
- 受保护接口验证 Bearer Token
- 用户信息注入请求扩展

### CORS 配置

- 允许指定源（FRONTEND_URL）
- 支持常用 HTTP 方法
- 允许携带凭证
- 预检请求缓存 1 小时

### 防垃圾评论

**多层过滤机制**：

1. **长度检查**：最小 5 字符
2. **链接检查**：最多 3 个链接
3. **敏感词过滤**：违禁词列表
4. **Cloudflare Turnstile**：人机验证

### API 安全

- SQL/NoSQL 注入防护（参数化查询）
- XSS 防护（内容净化）
- CSRF 防护（SameSite Cookie）
- 速率限制（可选）

---

## 部署架构

### Docker 容器化

**服务编排**：

- mongodb:7.0 (ReplicSet 模式)
- Meilisearch v1.5
- Rust Backend (Axum)
- Next.js Frontend

**构建优化**：

- Rust: 多阶段构建，最终镜像 ~50MB
- Node.js: Alpine 基础镜像，`.next` 缓存利用

### 生产环境架构

```
负载均衡层 (Nginx / AWS ALB)
    ↓
CDN / WAF (Cloudflare)
    ↓
应用服务器集群
    ├── Frontend (Next.js) × 2
    └── Backend (Rust/Axum) × 2
    ↓
数据层
    ├── MongoDB ReplicSet (3 节点)
    └── Meilisearch Cluster
```

### 环境配置

**后端环境变量**：

- MongoDB 连接字符串
- JWT 密钥
- OAuth 应用凭证
- OpenAI API Key
- Meilisearch 配置
- 前端 URL

**前端环境变量**：

- API URL
- 站点配置

---

## 性能优化

### 前端优化

| 优化项       | 技术                          | 效果             |
| ------------ | ----------------------------- | ---------------- |
| 代码分割     | Next.js 动态导入              | 减少初始加载体积 |
| 图片优化     | next/image + blur placeholder | 提升感知性能     |
| 预取         | Link prefetch                 | 即时页面切换     |
| 并行数据获取 | Promise.all                   | 减少 TTFB        |
| 服务端组件   | Server Components             | 减少客户端 JS    |

### 后端优化

| 优化项   | 技术           | 效果           |
| -------- | -------------- | -------------- |
| 连接池   | MongoDB 连接池 | 复用数据库连接 |
| 查询优化 | 索引 + 投影    | 减少查询时间   |
| 批量处理 | bulk_write     | 减少网络往返   |
| 异步任务 | tokio::spawn   | 非阻塞执行     |
| 内存缓存 | Moka           | 减少数据库查询 |

### 监控与日志

- **结构化日志**：tracing crate
- **请求追踪**：TraceLayer
- **错误报告**：Sentry (可选)
- **性能监控**：自定义指标

---

## 开发指南

### 环境配置

```bash
# 克隆项目
git clone https://github.com/yourusername/neo-space.git
cd neo-space

# 安装前端依赖
pnpm install

# 配置环境变量
cp .env.local.example .env.local
cp backend/.env.example backend/.env

# 启动开发服务器
pnpm dev           # 前端 (localhost:3000)
cd backend && cargo run  # 后端 (localhost:8000)
```

### 贡献流程

1. Fork 项目
2. 创建功能分支
3. 提交更改（遵循约定式提交）
4. 推送到分支
5. 创建 Pull Request

---

## 许可证

本项目采用 **AGPL** 许可证 - 详见 [LICENSE](LICENSE.md) 文件
