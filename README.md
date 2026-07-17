# Neo-Space

<div align="center">

**现代化全栈博客系统**

基于 Next.js 16 + Rust/Axum 构建的高性能博客平台，使用 Turborepo 编排前端、后台与后端服务

[![License](https://img.shields.io/badge/license-AGPL-blue.svg)](LICENSE.md)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black.svg)](https://nextjs.org/)
[![Rust](https://img.shields.io/badge/Rust-edition_2024-orange.svg)](https://www.rust-lang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.9-blueviolet.svg)](https://turbo.build/)
[![pnpm](https://img.shields.io/badge/pnpm-11.1-yellow.svg)](https://pnpm.io/)

[功能介绍](#核心特性) • [快速开始](#快速开始) • [项目结构](#项目结构) • [技术架构](#技术架构)

</div>

---

## 项目简介

Neo-Space 是一个功能丰富、性能卓越的现代化博客系统。仓库以 Turborepo monorepo 形式组织，包含三个独立的应用与一个共享包：

- **web**：Next.js 16 + React 19 前端，提供 SSR/SSG 渲染体验
- **admin**：基于 Vue 3 + Vite 的内容管理后台
- **backend**：Rust + Axum 的高性能 API 服务，构建时会将 admin 产物通过 `rust-embed` 内联到二进制中
- **packages/rich-react**：跨应用共享的富文本相关 React 组件

### 设计理念

- **性能优先**：Rust 后端 + Next.js 前端，追求极致性能
- **类型安全**：TypeScript / Rust 双端类型安全
- **现代技术栈**：采用 Web 与 Rust 生态最新的最佳实践
- **可扩展性**：模块化 + monorepo 设计，便于维护与扩展

> ℹ️ **关于 admin 后台**：`apps/admin` 派生自 [`mx-space/mx-admin`](https://github.com/mx-space/mx-admin)（AGPL-3.0），并在其基础上做了适配本项目数据模型与接口的改造。原项目版权归 mx-space 团队所有，按 AGPL-3.0 条款继续以 AGPL 形式分发。

---

## 核心特性

### 内容管理

| 功能         | 描述                                            |
| ------------ | ----------------------------------------------- |
| 文章系统     | 支持 Markdown、代码高亮、数学公式、图片管理     |
| 日记系统     | Mood / Weather / Location 标签的碎片化记录      |
| 页面系统     | 静态页面支持，关于、友链等独立页面              |
| 分类管理     | 文章分类系统，支持多级分类                      |

### 评论系统

- 多层级评论：支持无限嵌套回复
- 悄悄说功能：仅评论者和管理员可见
- 评论管理：置顶、隐藏、显示状态管理
- 垃圾评论过滤：多层过滤机制 + Cloudflare Turnstile
- 实时通知：WebSocket 实时推送新评论

### 用户系统

- OAuth 认证：支持 GitHub 与 QQ 登录
- 匿名用户：可绑定邮箱成为正式用户
- 权限管理：区分普通用户和管理员

### 友链系统

- 自动健康检查：定时检测友链可用性
- 申请审核：支持友链申请与审核流程
- RSS 订阅：支持友链 RSS Feed
- 技术栈标签：展示友链使用的技术栈

### AI 集成

- OpenAI 集成：文章摘要自动生成
- AI 评论回复：模拟博主口吻的智能回复
- 时间胶囊：AI 分析文章时效性

### 搜索功能

- Meilisearch 引擎：极速全文搜索
- 高亮显示：搜索结果关键词高亮
- 多维度搜索：支持文章和日记搜索

---

## 快速开始

### 环境要求

- Node.js >= 22
- pnpm >= 11
- Rust（edition 2024，建议使用 rustup 维护）
- MongoDB >= 7.0
- Meilisearch（可选，用于全文搜索）

### 安装与启动

```bash
# 克隆项目
git clone https://github.com/tnxg/neo-space.git
cd neo-space

# 安装依赖（pnpm workspace 会处理所有 apps 与 packages）
pnpm install

# 配置环境变量
cp apps/web/.env.local.example apps/web/.env.local
cp apps/backend/.env.example apps/backend/.env

# 启动全部开发服务（统一调度）
pnpm dev
```

### 单独启动某个应用

```bash
pnpm dev:web      # Next.js 前端 (默认 :3000)
pnpm dev:admin    # Vite admin 后台 (默认 :2323)
pnpm dev:backend  # Rust/Axum 后端 (默认 :8000)
```

### 构建

```bash
pnpm build           # 构建所有应用（Turbo 自动按依赖顺序）
pnpm build:web       # 仅构建前端
pnpm build:admin     # 仅构建 admin（产物会被 backend 通过 rust-embed 内联）
pnpm build:backend   # 仅构建 Rust 后端
```

### Docker

仓库提供了两个 compose 文件：

```bash
docker-compose up -d                       # 默认编排
docker-compose -f docker-compose.backend.yml up -d   # 仅启动后端依赖（DB / Meilisearch 等）
```

---

## 项目结构

```
neo-space/
├── apps/
│   ├── web/                 # Next.js 16 前端 (@neo-space/web)
│   │   ├── src/
│   │   │   ├── app/         # App Router
│   │   │   ├── components/  # 组件库
│   │   │   ├── lib/         # 工具库与 api-client
│   │   │   ├── hooks/       # 自定义 Hooks
│   │   │   ├── stores/      # Zustand 状态
│   │   │   ├── types/       # TypeScript 类型
│   │   │   └── actions/     # Server Actions
│   │   └── public/
│   │
│   ├── admin/               # Vue 3 admin 后台 (@neo-space/admin)
│   │   │                    # 派生自 mx-space/mx-admin (AGPL-3.0)
│   │   ├── src/
│   │   ├── index.html
│   │   └── vite.config.mts
│   │
│   └── backend/             # Rust/Axum 后端 (@neo-space/backend)
│       ├── src/
│       │   ├── main.rs      # 服务入口
│       │   ├── app.rs       # 应用状态与路由组装
│       │   ├── handlers/    # 请求处理器（auth/post/comment/link/...）
│       │   ├── routes/      # 路由定义
│       │   ├── models/      # 数据模型
│       │   ├── services/    # 业务服务
│       │   ├── tasks/       # 后台任务
│       │   ├── middleware/  # 中间件
│       │   ├── realtime/    # WebSocket 与事件总线
│       │   └── utils/
│       ├── Cargo.toml
│       └── Dockerfile
│
├── packages/
│   └── rich-react/          # 共享富文本 React 组件 (@neo-space/rich-react)
│
├── scripts/                 # 脚本（统一 dev 启动等）
├── turbo.json               # Turborepo 任务编排
├── pnpm-workspace.yaml      # pnpm workspace 定义
├── docker-compose.yml
└── docker-compose.backend.yml
```

---

<a id="技术架构"></a>

## 技术架构

### 整体架构

```
客户端层 (Browser / Mobile / RSS)
    ↓
CDN / 反向代理层 (Nginx / Cloudflare)
    ↓
应用层
    ├── apps/web       Next.js 前端       → 客户端状态 (Zustand)
    ├── apps/admin     Vue 3 管理后台     → 由 backend 内嵌静态托管
    └── apps/backend   Rust/Axum 服务     → 服务端缓存 (Moka)
    ↓
数据层
    ├── MongoDB (主数据库)
    ├── Meilisearch (搜索引擎)
    └── External APIs (OpenAI, OAuth)
```

### 技术栈总览

| 层级       | 选型                | 说明                       |
| ---------- | ------------------- | -------------------------- |
| 编排       | Turborepo 2.9       | monorepo 任务调度          |
| 包管理     | pnpm 11             | workspace 依赖管理         |
| 前端框架   | Next.js 16 / React 19 | SSR / SSG               |
| 前端语言   | TypeScript 5.9      | 类型安全                   |
| 前端样式   | Tailwind CSS 4      | 原子化 CSS                 |
| Admin 框架 | Vue 3 + Vite + Naive UI | 管理后台 UI            |
| 后端框架   | Axum 0.8            | 异步 Web 框架              |
| 运行时     | Tokio 1.52          | 异步运行时                 |
| 数据库     | MongoDB 7           | 主数据存储                 |
| 搜索       | Meilisearch         | 全文搜索                   |
| 缓存       | Moka 0.12 / SWR     | 后端 + 前端缓存            |
| 实时       | WebSocket + broadcast | 事件订阅推送             |
| 文档       | Utoipa + Swagger UI | OpenAPI 自动生成           |

### 前端 (apps/web)

- **路由**：Next.js App Router，路由组 `(main)` 共享布局
- **状态**：Zustand（auth / theme / search / comment）+ SWR + URL state
- **主题**：CSS 变量驱动，`light / dark / system` 三模式持久化
- **渲染策略**：SSR（首页、文章、分类）/ SSG（RSS）/ CSR（评论、搜索弹窗等）
- **API**：统一通过 `src/lib/api-client.ts` 调用，类型定义在 `src/types/api.ts`
- **响应包装**：所有接口返回 `ApiResponse<T> = { code, status, message, data }`

### Admin (apps/admin)

- 基于 mx-space/mx-admin 改造，使用 Vue 3 + Vite + Naive UI + Pinia
- 富文本编辑器集成 CodeMirror、Monaco、Lexical 与 Haklex Rich 系列
- 通过 `pnpm build:admin` 产物输出至 `apps/admin/dist`，再由 backend 通过 `rust-embed` 嵌入二进制
- 上线时由 backend 自身托管 admin 静态资源，无需独立部署

### 后端 (apps/backend)

- **AppState**：MongoDB 连接池、Moka 缓存、reqwest 客户端、WebSocket 事件总线、应用配置、Meilisearch 客户端
- **路由**：`Router::nest()` 模块化分组，附带 CORS / Trace / Auth 中间件
- **处理器分层**：缓存检查 → DB 查询 → 缓存写入 → 事件广播 → 前端缓存失效通知
- **后台任务**：`tokio::spawn` 调度
  - 友链健康检查（定时）
  - 网易云音乐播放状态（轮询）
  - Meilisearch 启动时全量同步
- **写后同步**：后台内容变更成功后，显式失效 Moka 缓存、同步 Meilisearch，并通知 Next.js 刷新 ISR
- **OpenAPI**：通过 Utoipa 宏自动生成，Swagger UI 提供交互式文档

---

## 数据模型

### Post (文章)

- 基础：`_id`、`title`、`text`、`slug`、`categoryId`
- 关联：`category`（查询时填充）
- 摘要：`summary`（手动）、`aiSummary`（AI 生成）
- 其他：`tags[]`、`allowComment`、`isPublished`、`copyright`、`images[]`

### Note (日记)

- 基础：`_id`、`nid`（数字 ID）、`title`、`text`
- 情境：`mood`、`weather`、`location`
- 配置：`allowComment`、`isPublished`、`bookmark`

### Comment (评论)

- 基础：`_id`、`ref`、`refType`、`author`、`mail`、`link`
- 内容：`text`（Markdown）
- 状态：`state`（0=未读 / 1=已读 / 2=垃圾 / 3=隐藏）
- 功能：`pin`（置顶）、`isWhispers`（悄悄说）
- 关联：`rid`（回复 ID）、`pid`（父 ID）、`children`
- AI：`aiReply`

### User (用户)

- 基础：`_id`、`username`、`mail`、`role`
- 认证：`password`、`accounts[]`（OAuth）
- 资料：`avatar`、`website`、`bio`

### Link (友链)

- 基础：`_id`、`name`、`url`、`description`、`avatar`
- 状态：`active`、`isPublished`
- 健康：`healthStatus`、`lastChecked`、`responseTime`
- 其他：`techStack[]`、`rss`

### 索引设计

| 集合       | 索引字段                       | 类型      |
| ---------- | ------------------------------ | --------- |
| posts      | slug, categoryId, created      | 唯一/普通 |
| notes      | nid, created                   | 唯一/普通 |
| comments   | ref+refType, rid, created      | 复合/普通 |
| users      | username, accounts.providerId  | 唯一      |
| links      | url, active                    | 唯一/普通 |
| categories | slug, name                     | 唯一      |

---

## API 设计

### 路由结构

```
/api
├── /auth                # OAuth、当前用户、绑定匿名
├── /posts               # 文章 CRUD、slug、相邻文章
├── /notes               # 日记
├── /comments            # 评论
├── /links               # 友链
├── /categories          # 分类
├── /admin               # 管理接口
├── /aggregate/nav       # 导航聚合（recent + categories）
├── /revalidate          # 前端缓存重验证
├── /config              # 站点配置
├── /health              # 健康检查
└── /ws                  # WebSocket
```

### 标准响应

```json
// 成功
{ "code": 200, "status": "success", "message": "操作成功", "data": { } }

// 分页
{
  "code": 200, "status": "success", "message": "获取成功",
  "data": {
    "items": [],
    "pagination": {
      "total": 100, "current_page": 1, "total_page": 10,
      "size": 10, "has_next_page": true, "has_prev_page": false
    }
  }
}

// 错误
{ "code": 400, "status": "failed", "message": "错误描述", "data": null }
```

---

## 实时通信

### 事件类型

| 事件                | 说明             |
| ------------------- | ---------------- |
| comment.created     | 新评论创建       |
| comment.updated     | 评论更新         |
| comment.deleted     | 评论删除         |
| post.created        | 文章发布         |
| post.updated        | 文章更新         |
| link.health_changed | 友链健康状态变化 |

### 实现

- 后端：`tokio::sync::broadcast` 维护全局事件通道，由业务写入和健康检查任务发布事件
- 前端：`useWebSocket` Hook 自动连接 / 重连，结合 SWR 自动刷新缓存与 Toast 通知

---

## 缓存策略

```
L1  Next.js Data Cache         (服务端)
L2  Browser HTTP Cache         (浏览器)
L3  CDN Cache                  (边缘)
L4  Application Cache          (Moka / SWR / Zustand persist)
L5  Database Query Cache       (MongoDB / Meilisearch)
```

**Moka（后端）**：容量 10,000，TTL 5 分钟，TTI 1 分钟，LRU 驱逐。
**SWR（前端）**：去重 5 秒，重试 3 次，保持旧数据，窗口聚焦/网络重连自动重新验证。
**失效**：路径级 (`revalidatePath`)、标签级 (`revalidateTag`)、TTL/TTI 到期、WebSocket 事件触发。

---

## 安全

- **JWT**：HS256，7 天有效期，HttpOnly Cookie
- **CORS**：白名单 `FRONTEND_URL`，允许凭证，预检缓存 1 小时
- **防垃圾评论**：长度检查、链接数限制、敏感词过滤、Cloudflare Turnstile
- **API 防护**：参数化查询、内容净化、SameSite Cookie，可选速率限制

---

## 部署

### Docker 化

- MongoDB 7（ReplicaSet 模式）
- Meilisearch v1.5
- Backend：多阶段构建，最终镜像 ~50MB（admin 已通过 rust-embed 内嵌）
- Frontend：Alpine 基础镜像 + `.next` 缓存优化

### 生产架构

```
负载均衡层 (Nginx / AWS ALB)
    ↓
CDN / WAF (Cloudflare)
    ↓
应用集群
    ├── Frontend (Next.js) × N
    └── Backend (Rust/Axum, 内含 admin) × N
    ↓
数据层
    ├── MongoDB ReplicaSet (3 节点)
    └── Meilisearch
```

### 环境变量

- **backend**：MongoDB 连接串、JWT 密钥、OAuth 应用凭证、OpenAI API Key、Meilisearch 配置、`FRONTEND_URL`
- **web**：`NEXT_PUBLIC_API_URL` 等站点配置

---

## 开发与贡献

```bash
pnpm install
pnpm dev               # 同时启动 web / admin / backend
pnpm lint              # 全仓 lint
pnpm typecheck         # 全仓类型检查
```

提交流程：

1. Fork 项目并创建功能分支
2. 提交更改（建议使用约定式提交）
3. 推送并创建 Pull Request

---

## 许可证与致谢

本项目以 **AGPL-3.0** 协议发布，详见 [LICENSE.md](LICENSE.md)。

### 第三方致谢

- **[mx-space/mx-admin](https://github.com/mx-space/mx-admin)** — `apps/admin` 派生自该项目（AGPL-3.0），版权归原作者所有，本仓库在此基础上进行了适配本项目数据模型与 API 的改造，并继续以 AGPL-3.0 形式分发。

- 感谢 Next.js、Axum、MongoDB、Meilisearch、Naive UI 等开源项目使本项目成为可能。
